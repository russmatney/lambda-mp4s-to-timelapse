var Q = require('q');
var path = require('path');
var execute = require('lambduh-execute');
var validate = require('lambduh-validate');
var download = require('lambduh-get-s3-object');
var upload = require('lambduh-put-s3-object');

var pathToRenamePngs = './bin/rename-pngs.sh';
var pathToFilesToMp4 = './bin/files-to-mp4.sh';

exports.handler = function(event, context) {
  var result = {};

  event = {
    bucket: 'russbosco',
    key: 'events/timelapseparty/0001-CH1CDI-0.png'
  }

  //create /tmp/pngs/
  execute(result, {
    shell: 'mkdir -p /tmp/pngs/; mkdir -p /tmp/renamed-pngs/;',
    logOutput: true
  })

  //download pngs
  .then(function(result) {
    console.log('downloading');
    return download(result, {
      srcBucket: event.bucket,
      srcKey: event.key,
      downloadFilepath: '/tmp/pngs/' + path.basename(event.key)
    })
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
      dstKey: path.dirname(event.key) + '/000000timelapse.mp4',
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
