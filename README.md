# lambda-mp4s-to-timelapse

converts mp4s into a timelapse with music

# Usage

Invoke this function like any lambda function, as documented in the aws sdk.

- [JavaScript](http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/Lambda.html#invoke-property)
- [Ruby](http://docs.aws.amazon.com/sdkforruby/api/Aws/Lambda/Client.html#invoke-instance_method)
- [PHP](http://docs.aws.amazon.com/aws-sdk-php/latest/class-Aws.Lambda.LambdaClient.html#_invokeAsync)
- [Python](http://boto.readthedocs.org/en/latest/)
- OR on the function's "edit" tab via amazon's interface
- OR via the AWS CLI

# Payload

*all fields are required*

- `sourceFiles` - An array of mp4 urls  to be downloaded and included in the timelapse
- `musicUrl` - Url for an mp3 to be downloaded and included in the timelapse
- `destBucket` - S3 bucket to dump the timelapse into
- `destKey` - Key for the file to be saved to on S3

## example
```json
	{
		"destBucket": "my-s3-bucket",
		"destKey": "my-rendered-video",
		"musicUrl": "http://example.com/songs/song.mp3",
		"sourceFiles": [
			"http://example.com/videos/my-video.mp4",
			"http://example.com/videos/my-other-video.mp4",
			"http://example.com/videos/example-video.mp4",
			"http://example.com/videos/other-example-video.mp4",
		]
	}
```

