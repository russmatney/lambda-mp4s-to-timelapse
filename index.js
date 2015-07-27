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
    "sourceFiles": true,
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
    event.filepath = "/tmp/song.mp3";
    event.url = event.musicUrl;
    return downloadFile(event);
  })

  //download mp4s
  .then(function(event) {
    var def = Q.defer();

    var promises = [];
    var vidCount = event.sourceFiles.length;
    event.sourceFiles.forEach(function(url) {
      event.filepath = "/tmp/videos/"+url.substring(url.lastIndexOf('/')+1);
      event.url = url;
      promises.push(downloadFile(event))
    });

    Q.all(promises).then(function(results) {
      console.log('downloaded ' + results.length + ' videos!');
      var timeout = 1000;
      setTimeout(function() {
        console.log(timeout + " ms later...");
        def.resolve(results[0]);
      }, timeout);
    })
    .fail(function(err) {
      console.log('failing here')
      def.reject(err);
    });

    return def.promise;
  })

  //stitch mp4s together
  .then(function(event) {
    return execute(event, {
      bashScript: '/var/task/stitch',
      bashParams: [
        '/tmp/song.mp3', //input song
        '/tmp/final.mp4', //output filename
        '/tmp/videos/**.mp4' //mp4s dir
      ],
      logOutput: true
    })
  })

  //upload timelapse
  .then(function(event) {
    return upload(event, {
      dstBucket: event.destBucket,
      dstKey: event.destKey+".mp4",
      uploadFilepath: '/tmp/final.mp4'
    })
  })

  .then(function(event){
    console.log('finished');
    console.log(event);
    context.done()
  })

  .fail(function(err) {
    console.log(err);
    context.done({"converted": true}, err);
  });

}
