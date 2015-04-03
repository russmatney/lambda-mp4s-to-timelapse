var Q = require('q');
var path = require('path');
var execute = require('lambduh-execute');
var validate = require('lambduh-validate');
var download = require('lambduh-get-s3-object');
var upload = require('lambduh-put-s3-object');

var AWS = require('aws-sdk');
var s3 = new AWS.S3();

var pathToRenamePngs = './bin/rename-pngs.sh';
var pathToFilesToMp4 = './bin/files-to-mp4.sh';

exports.handler = function(event, context) {
  var result = {};

  event = {
    bucket: 'russbosco',
    prefix: 'events/timelapseparty/'
  }

  //create /tmp/pngs/
  execute(result, {
    shell: 'mkdir -p /tmp/pngs/; mkdir -p /tmp/renamed-pngs/;',
    logOutput: true
  })

  //download pngs
  .then(function(result) {
    console.log('getting png keys');
    var def = Q.defer();

    s3.listObjects({
      Bucket: event.bucket,
      Prefix: event.prefix
    }, function(err, data) {
      console.log('err');
      console.log(err);
      console.log('data');
      console.log(data.Contents[0]);

      var keys = data.Contents.map(function(object) {
        if (/\.png$/.test(object.Key))
          return object.Key;
      })
      keys = keys.filter(function(v) { return v; });

      console.log(keys);
      console.log('downloading pngs');

      var promises = [];
      keys.forEach(function(key) {

        promises.push(download(result, {
          srcBucket: event.bucket,
          srcKey: key,
          downloadFilepath: '/tmp/pngs/' + path.basename(key)
        }))

      });

      console.log('promises');
      console.log(promises);

      Q.all(promises)
        .then(function(results) {
          console.log('downloaded!');
          console.log(results);
          def.resolve(results[0]);
        });

    });

    return def.promise;
  })

  //rename, mv pngs
  .then(function(result) {
    console.log('renaming');
    return execute(result, {
      bashScript: pathToRenamePngs,
      bashParams: [
        '/tmp/pngs/*.png',// input files
        '/tmp/renamed-pngs/'//output dir
      ],
      logOutput: true
    })
  })

  //convert pngs to video with song
  .then(function(result) {
    console.log('creating timelapse');
    return execute(result, {
      bashScript: pathToFilesToMp4,
      bashParams: [
        '/tmp/renamed-pngs/%04d.png',//input files
        '/tmp/song.mp3',//input song
        '/tmp/timelapse.mp4'//output filename
      ],
      logOutput: true
    })
  })

  //upload timelapse
  .then(function(result) {
    console.log('uploading');
    return upload(result, {
      dstBucket: event.bucket,
      dstKey: event.prefix + '----timelapse.mp4',
      uploadFilepath: '/tmp/timelapse.mp4'
    })
  })

  //clean up
  .then(function(result){
    return execute(result, {
      shell: 'rm /tmp/renamed-pngs/*',
      logOutput: true
    })
  })

  .then(function(result){
    console.log('result');
    context.done()
  }).fail(function(err) {
    console.log('errorrrrrr');
    context.done(null, err);
  });

}
