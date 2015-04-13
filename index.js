var Q = require('q');
var path = require('path');

var execute = require('lambduh-execute');
var validate = require('lambduh-validate');
var s3Download = require('lambduh-get-s3-object');
var upload = require('lambduh-put-s3-object');
var downloadFile = require('lambduh-download-file');

process.env['PATH'] = process.env['PATH'] + ':/tmp/:' + process.env['LAMBDA_TASK_ROOT']

var AWS = require('aws-sdk');
var s3 = new AWS.S3();

exports.handler = function(event, context) {
  validate(event, {
    "sourceBucket": true,
    "sourceDir": true,
    "musicUrl": true,
    "destBucket": true,
    "destKey": true
  })

  .then(function(event) {
    return execute(event, {
      shell: 'mkdir -p /tmp/videos'
    })
  })

  //download song
  .then(function(event) {
    return downloadFile({
      filepath: "/tmp/song.mp3",
      url: event.musicUrl
    });
  })

  //download mp4s
  .then(function(event) {
    var def = Q.defer();

    s3.listObjects({
      Bucket: event.sourceBucket,
      Prefix: event.sourceDir
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
          promises.push(s3Download(event, {
            srcBucket: event.sourceBucket,
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
  .then(function(event) {
    return execute(event, {
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
  .then(function(event) {
    return upload(event, {
      dstBucket: event.destBucket,
      dstKey: event.destKey,
      uploadFilepath: '/tmp/timelapse-final.mp4'
    })
  })

  .then(function(event){
    console.log('finished');
    console.log(event);
    context.done()
  })

  .fail(function(err) {
    console.log(err);
    context.done(null, err);
  });

}
