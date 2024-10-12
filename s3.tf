resource "aws_s3_bucket" "call_recordings" {
  bucket = "call-recordings-bucket-pii-poc"
  force_destroy = true
}

resource "aws_s3_bucket" "call_recordings_transcriptions" {
  bucket = "call-recordings-transcriptions-bucket-pii-poc"
  force_destroy = true
}

resource "aws_s3_bucket_notification" "call_recordings_notification" {
  bucket = aws_s3_bucket.call_recordings.id

  lambda_function {
    lambda_function_arn = aws_lambda_function.transcribe_call_recording_lambda.arn
    events              = ["s3:ObjectCreated:*"]
    filter_suffix       = ".wav"
  }

  depends_on = [aws_lambda_permission.s3_recordings_trigger_permission]
}

resource "aws_s3_bucket_notification" "call_recordings_transcriptions_notifications" {
  bucket = aws_s3_bucket.call_recordings_transcriptions.id

  lambda_function {
    lambda_function_arn = aws_lambda_function.analyse_call_recording_lambda.arn
    events              = ["s3:ObjectCreated:*"]
    filter_suffix       = ".json"
  }

  depends_on = [aws_lambda_permission.s3_recordings_transcriptions_trigger_permission]
}
