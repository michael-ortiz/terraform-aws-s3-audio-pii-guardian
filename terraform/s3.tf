locals {
  current_account_id = data.aws_caller_identity.current.account_id
}

resource "aws_s3_bucket" "audio" {
  bucket        = "${var.audio_bucket_name}-${local.current_account_id}"
  force_destroy = true
}

resource "aws_s3_bucket" "transcriptions" {
  bucket        = "${var.transcriptions_bucket_name}-${local.current_account_id}"
  force_destroy = true
}

resource "aws_s3_bucket_notification" "audio_notification" {
  count = local.auto_s3_put_trigger_analysis ? 1 : 0
  bucket = aws_s3_bucket.audio.id

  lambda_function {
    lambda_function_arn = aws_lambda_function.pii_audio_api_handler_function.arn
    events              = ["s3:ObjectCreated:*"]
    filter_suffix       = ".${local.media_format}"
  }

  depends_on = [aws_lambda_permission.s3_recordings_trigger_permission]
}

resource "aws_s3_bucket_notification" "transcriptions_notifications" {
  bucket = aws_s3_bucket.transcriptions.id

  lambda_function {
    lambda_function_arn = aws_lambda_function.pii_audio_api_handler_function.arn
    events              = ["s3:ObjectCreated:*"]
    filter_suffix       = local.transcriptions_file_suffix
  }

  depends_on = [aws_lambda_permission.s3_recordings_transcriptions_trigger_permission]
}
