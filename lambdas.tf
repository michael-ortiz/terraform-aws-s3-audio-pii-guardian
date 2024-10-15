locals {
  pii_audio_api_handler_function_path = "${path.module}/lambdas/pii-audio-api-handler"
  redact_audio_processor_lambda_path  = "${path.module}/lambdas/pii-audio-redactor"

  api_handler_function_name = "pii-audio-api-handler-function"
  redactor_function_name    = "pii-audio-redactor-function"

  lambda_zip_file_name = "lambda.zip"
}

# Lambda Functions
resource "aws_lambda_function" "pii_audio_api_handler_function" {
  filename         = "${local.pii_audio_api_handler_function_path}/${local.lambda_zip_file_name}"
  function_name    = local.api_handler_function_name
  role             = aws_iam_role.pii_audio_api_handler_function.arn
  handler          = "dist/index.handler"
  source_code_hash = data.archive_file.lambda_zip_api_handler.output_sha512

  runtime = "nodejs20.x"

  timeout = 30

  environment {
    variables = {
      // Transcribe audio recordings variables
      AUDIO_BUCKET              = aws_s3_bucket.audio.id
      TRANSCRIPTIONS_BUCKET     = aws_s3_bucket.transcriptions.id
      PII_ENTITIES              = join(",", var.pii_entities)
      MEDIA_FORMAT              = var.media_format
      DEFAULT_LANGUAGE_CODE     = var.default_language_code
      TRANSCRIBE_PROBABILITY    = var.auto_transcribe_probability_percent
      TRANSCRIPTION_FILE_SUFFIX = var.transcriptions_file_suffix

      // Analyze audio recordings variables
      NOTIFICATIONS_WEBHOOK           = var.notification_webhook_url
      SLACK_NOTIFICATIONS_WEBHOOK     = var.slack_notification_webhook_url
      AWS_TRANSCRIBE_REDACTED_PII_TAG = "[PII]" // This is the tag that is used if any PII is found in the transcription. Do not change this value
      REDACT_AUDIO                    = var.redact_audio
      OVERWRITE_ORIGINAL_AUDIO        = var.overwrite_original_audio

      // Lambda function names
      REDACTOR_FUNCTION_NAME = local.redactor_function_name
      CURRENT_LAMBDA_NAME    = local.api_handler_function_name
    }
  }

  depends_on = [null_resource.build_package_lambdas]
}

resource "aws_lambda_function" "pii_audio_redactor_function" {
  count            = var.redact_audio ? 1 : 0
  filename         = "${local.redact_audio_processor_lambda_path}/${local.lambda_zip_file_name}"
  function_name    = local.redactor_function_name
  role             = aws_iam_role.redact_pii_audio_recording_lambda.arn
  handler          = "app.lambda_handler"
  source_code_hash = data.archive_file.lambda_zip_redactor.output_sha512

  timeout = 300

  runtime = "python3.12"

  # Attach the FFmpeg layer
  layers = [aws_lambda_layer_version.ffmpeg_layer.arn]

  environment {
    variables = {
      AUDIO_BUCKET             = aws_s3_bucket.audio.id
      REDACT_AUDIO             = var.redact_audio
      OVERWRITE_ORIGINAL_AUDIO = var.overwrite_original_audio
    }
  }

  depends_on = [null_resource.build_package_lambdas]
}

## Log Groups

resource "aws_cloudwatch_log_group" "pii_audio_api_handler_log_group" {
  name              = "/aws/lambda/${local.api_handler_function_name}"
}

resource "aws_cloudwatch_log_group" "pii_audio_redactor_log_group" {
  name              = "/aws/lambda/${local.redactor_function_name}"
}

## Lambda Permissions

resource "aws_lambda_permission" "s3_recordings_trigger_permission" {
  statement_id  = "AllowExecutionFromAudioS3Bucket"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.pii_audio_api_handler_function.arn
  principal     = "s3.amazonaws.com"
  source_arn    = aws_s3_bucket.audio.arn
}

resource "aws_lambda_permission" "s3_recordings_transcriptions_trigger_permission" {
  statement_id  = "AllowExecutionFromTranscriptionsS3Bucket"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.pii_audio_api_handler_function.arn
  principal     = "s3.amazonaws.com"
  source_arn    = aws_s3_bucket.transcriptions.arn
}

// Function URL
resource "aws_lambda_function_url" "pii_audio_api_handler_function" {
  count = var.create_api_endpoint ? 1 : 0
  function_name      = aws_lambda_function.pii_audio_api_handler_function.function_name
  authorization_type = var.api_authorization_type
}

output "api_url" {
  value = try(aws_lambda_function_url.pii_audio_api_handler_function[0].function_url, null)
}

// FFmpeg Layer
resource "aws_lambda_layer_version" "ffmpeg_layer" {
  filename   = "${local.redact_audio_processor_lambda_path}/layer/ffmpeg.zip"
  layer_name = "ffmpeg"
  depends_on = [null_resource.build_ffmpeg_layer]
}


// Build Lambda Zip Files
data "archive_file" "lambda_zip_api_handler" {
  type        = "zip"
  output_path = "${local.pii_audio_api_handler_function_path}/${local.lambda_zip_file_name}"
  source_dir  = local.pii_audio_api_handler_function_path
  depends_on  = [null_resource.build_package_lambdas]
  excludes = [
    local.lambda_zip_file_name
  ]
}

data "archive_file" "lambda_zip_redactor" {
  type        = "zip"
  output_path = "${local.redact_audio_processor_lambda_path}/${local.lambda_zip_file_name}"
  source_dir  = local.redact_audio_processor_lambda_path
  excludes = [
    local.lambda_zip_file_name
  ]
  depends_on = [null_resource.build_ffmpeg_layer]
}

resource "null_resource" "build_package_lambdas" {
  provisioner "local-exec" {
    command = "make install-lambdas-dependencies && make build-lambdas"
  }
}

resource "null_resource" "build_ffmpeg_layer" {
  provisioner "local-exec" {
    command = "make create-ffmpeg-layer"
  }
}
