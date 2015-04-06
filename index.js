var Q = require('q');
var path = require('path');
var execute = require('lambduh-execute');
var validate = require('lambduh-validate');
var download = require('lambduh-get-s3-object');
var upload = require('lambduh-put-s3-object');

process.env['PATH'] = process.env['PATH'] + ':/tmp/:' + process.env['LAMBDA_TASK_ROOT']

var AWS = require('aws-sdk');
var s3 = new AWS.S3();

exports.handler = function(event, context) {
  var start = new Date();
  var pngsDownloaded;
  var pngsRenamed;
  var mp4sCreated;
  var mp4sStitched;
  var mp4Uploaded;
  var result = {};

  console.log(require('os').cpus().length);
  //create /tmp/pngs/
  execute(result, {
    shell: 'mkdir -p /tmp/pngs/; mkdir -p /tmp/renamed-pngs/;',
    logOutput: true
  })

  /*
  .then(function(result) {
    return execute(result, {
      shell: 'echo "ls /tmp/"; ls /tmp/; echo "ls /var/task/"; ls /var/task/;',
      logOutput: true
    })
  })
  */

  .then(function(result) {
    return download(result, {
      srcBucket: event.bucket,
      srcKey: event.songKey,
      downloadFilepath: '/tmp/song.mp3'
    });
  })

  //download pngs
  .then(function(result) {
    console.log('getting png keys');
    var def = Q.defer();

    s3.listObjects({
      Bucket: event.bucket,
      Prefix: event.prefix
    }, function(err, data) {
      if (err) def.reject(err);
      else {

        var keys = data.Contents.map(function(object) {
          if (/\.png$/.test(object.Key))
            return object.Key;
        })
        keys = keys.filter(function(v) { return v; });

        keys = keys.slice(0, event.fileNum || 100)
        console.log('downloading ' + keys.length + ' pngs');

        var promises = [];
        keys.forEach(function(key) {
          promises.push(download(result, {
            srcBucket: event.bucket,
            srcKey: key,
            downloadFilepath: '/tmp/pngs/' + path.basename(key)
          }))
        });

        Q.all(promises)
          .then(function(results) {
            console.log('downloaded!');
            def.resolve(results[0]);
          })
          .fail(function(err) {
            def.reject(err);
          });
      }
    });

    return def.promise;
  })

  //rename, mv pngs
  .then(function(result) {
    pngsDownloaded = new Date();
    console.log('renaming');
    return execute(result, {
      bashScript: '/var/task/rename-pngs',
      bashParams: [
        '/tmp/pngs/*.png',// input files
        '/tmp/renamed-pngs/'//output dir
      ],
      logOutput: true
    })
  })

  //convert pngs to mp4
  .then(function(result) {
    var def = Q.defer();
    pngsRenamed = new Date();
    console.log('creating timelapse');

    var promises = [];
    promises.push(execute(result, {
      bashScript: '/var/task/files-to-mp4',
      bashParams: [
        '/tmp/renamed-pngs/%04d.png',//input files
        '/tmp/timelapse1.mp4'//output filename
      ],
      logOutput: true
    }))

    promises.push(execute(result, {
      bashScript: '/var/task/files-to-mp4',
      bashParams: [
        '/tmp/renamed-pngs/%04d.png',//input files
        '/tmp/timelapse2.mp4'//output filename
      ],
      logOutput: true
    }))

    Q.all(promises)
      .then(function(results) {
        def.resolve(results[0]);
      })
      .fail(function(err) {
        def.reject(err);
      });

    return def.promise;
  })

  //stitch mp4s together
  .then(function(result) {
    mp4sCreated = new Date();

    return execute(result, {
      bashScript: '/var/task/stitch-mp4s',
      bashParams: [
        //TODO: handle input videos as array/dir
        '/tmp/timelapse1.mp4', //input
        '/tmp/timelapse2.mp4', //input
        '/tmp/song.mp3', //input song
        '/tmp/timelapse-final.mp4' //output filename
      ],
      logOutput: true
    })
  })

  //upload timelapse
  .then(function(result) {
    mp4sStitched = new Date();
    console.log('uploading');
    return upload(result, {
      dstBucket: event.bucket,
      dstKey: event.prefix + '----timelapse.mp4',
      uploadFilepath: '/tmp/timelapse-final.mp4'
    })
  })

  //clean up
  .then(function(result){
    mp4Uploaded = new Date();
    return execute(result, {
      shell: 'rm /tmp/renamed-pngs/*; rm /tmp/timelapse*',
      logOutput: true
    })
  })

  .then(function(result){
    console.log('result');
    context.done()

    console.log('total duration');
    console.log((new Date()).getTime() - start.getTime());
    console.log('start -> pngs downloaded');
    console.log(pngsDownloaded.getTime() - start.getTime());
    console.log('pngs downloaded -> pngs renamed');
    console.log(pngsRenamed.getTime() - pngsDownloaded.getTime());
    console.log('renamed -> mp4sCreated');
    console.log(mp4sCreated.getTime() - pngsRenamed.getTime());
    console.log('mp4s -> stitched');
    console.log(mp4sStitched.getTime() - mp4sCreated.getTime());
    console.log('stitched -> uploaded');
    console.log(mp4Uploaded.getTime() - mp4sStitched.getTime());
    console.log('uploaded -> finished');
    console.log((new Date()).getTime() - mp4Uploaded.getTime());

  }).fail(function(err) {
    console.log('errorrrrrr');
    console.log(err);
    context.done(null, err);
  });

}
