resource "random_integer" "priority" {
  min = 1000
  max = 9999
}

resource "aws_s3_bucket" "audio_recordings" {
  bucket        = "audio-recordings-bucket-${random_integer.priority.result}"
  force_destroy = true
}

resource "aws_s3_bucket" "audio_recordings_transcriptions" {
  bucket        = "audio-recordings-pii-transcriptions-bucket-${random_integer.priority.result}"
  force_destroy = true
}

resource "aws_s3_bucket_notification" "audio_recordings_notification" {
  count = local.analyse_audio_recording_on_s3_put ? 1 : 0
  bucket = aws_s3_bucket.audio_recordings.id

  lambda_function {
    lambda_function_arn = aws_lambda_function.transcribe_audio_recordings_lambda.arn
    events              = ["s3:ObjectCreated:*"]
    filter_suffix       = local.audio_file_suffix_suffix
  }

  depends_on = [aws_lambda_permission.s3_recordings_trigger_permission]
}

resource "aws_s3_bucket_notification" "audio_recordings_transcriptions_notifications" {
  bucket = aws_s3_bucket.audio_recordings_transcriptions.id

  lambda_function {
    lambda_function_arn = aws_lambda_function.analyse_audio_recordings_lambda.arn
    events              = ["s3:ObjectCreated:*"]
    filter_suffix       = local.transcriptions_file_suffix
  }

  depends_on = [aws_lambda_permission.s3_recordings_transcriptions_trigger_permission]
}
