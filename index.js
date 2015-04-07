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
    "mp4sSrcDir": true,
    "timelapseDstKey": true
  })

  .then(function(result) {
    return execute(result, {
      shell: 'mkdir -p /tmp/videos'
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
    var def = Q.defer();

    s3.listObjects({
      Bucket: result.bucket,
      Prefix: result.mp4sSrcDir
    }, function(err, data) {
      if (err) def.reject(err);
      else {

        var keys = data.Contents.map(function(object) {
          if (!/final\.mp4$/.test(object.Key) && /\.mp4$/.test(object.Key))
            return object.Key;
        })
        keys = keys.filter(function(v) { return v; });

        var promises = [];
        var vidCount = 0;
        keys.forEach(function(key) {
          promises.push(download(result, {
            srcBucket: result.bucket,
            srcKey: key,
            downloadFilepath: '/tmp/videos/' + path.basename(key)
          }))
        });

        Q.all(promises)
          .then(function(results) {
            console.log('downloaded ' + results.length + ' videos!');
            var timeout = 1000;
            setTimeout(function() {
              console.log(timeout + " ms later...");
              def.resolve(results[0]);
            }, timeout);
          })
          .fail(function(err) {
            def.reject(err);
          });

      }
    });

    return def.promise;
  })

  //stitch mp4s together
  .then(function(result) {
    return execute(result, {
      bashScript: '/var/task/stitch-mp4s',
      bashParams: [
        '/tmp/videos/**.mp4', //mp4s dir
        '/tmp/song.mp3', //input song
        '/tmp/timelapse-final.mp4' //output filename
      ],
      logOutput: true
    })
  })

  //upload timelapse
  .then(function(result) {
    return upload(result, {
      dstBucket: result.bucket,
      dstKey: result.timelapseDstKey,
      uploadFilepath: '/tmp/timelapse-final.mp4'
    })
  })

  .then(function(result){
    console.log('finished');
    console.log(result);
    context.done()
  })

  .fail(function(err) {
    console.log(err);
    context.done(null, err);
  });

}
