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
  var result = event;

  validate(result, {
    "bucket": true,
    "songKey": true,
    "prefix": true
  })

  .then(function(result) {
    return execute(result, {
      shell: 'mkdir -p /tmp/mp4s'
    })
  })

  //download song
  .then(function(result) {
    return download(result, {
      srcBucket: result.bucket,
      srcKey: result.songKey,
      downloadFilepath: '/tmp/song.mp3'
    });
  })

  //download mp4s
  .then(function(result) {
    console.log('getting mp4 keys');
    var def = Q.defer();

    s3.listObjects({
      Bucket: result.bucket,
      Prefix: result.prefix
    }, function(err, data) {
      if (err) def.reject(err);
      else {

        var keys = data.Contents.map(function(object) {
          if (/\.mp4$/.test(object.Key))
            return object.Key;
        })
        keys = keys.filter(function(v) { return v; });

        console.log(keys.length + ' mp4s found');

        var promises = [];
        var vidCount = 0;
        keys.forEach(function(key) {
          promises.push(download(result, {
            srcBucket: result.bucket,
            srcKey: key,
            downloadFilepath: '/tmp/mp4s/video' + vidCount++ + ".mp4"
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

  //endcard
  .then(function(result) {
    return result;
  })

  //stitch mp4s together
  .then(function(result) {
    return execute(result, {
      bashScript: '/var/task/stitch-mp4s',
      bashParams: [
        '/tmp/mp4s/*.mp4', //mp4s dir
        '/tmp/song.mp3', //input song
        '/tmp/timelapse-final.mp4' //output filename
      ],
      logOutput: true
    })
  })

  //upload timelapse
  .then(function(result) {
    console.log('uploading');
    return upload(result, {
      dstBucket: result.bucket,
      dstKey: result.prefix + '--timelapse-final.mp4',
      uploadFilepath: '/tmp/timelapse-final.mp4'
    })
  })

  .then(function(result){
    console.log('result');
    console.log(result);
    context.done()

  }).fail(function(err) {
    console.log('errorrrrrr');
    console.log(err);
    context.done(null, err);
  });

}
