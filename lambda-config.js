module.exports = {
  region: 'us-east-1',
  handler: 'index.handler',
  role: 'arn:aws:iam::106586740595:role/executionrole',
  functionName: 'mp4s-to-timelapse',
  timeout: 60
}
