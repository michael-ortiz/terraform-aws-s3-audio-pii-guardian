locals {
  pii_audio_api_handler_function_path = "../${path.module}/lambdas/pii-audio-api-handler"
  redact_audio_processor_lambda_path  = "../${path.module}/lambdas/pii-audio-redacter"

  api_handler_function_name = "pii-audio-api-handler-function"
  redacter_function_name    = "pii-audio-redacter-function"

  lambda_zip_file_name = "lambda.zip"
}

resource "aws_lambda_function" "pii_audio_api_handler_function" {
  filename         = "${local.pii_audio_api_handler_function_path}/${local.lambda_zip_file_name}"
  function_name    = local.api_handler_function_name
  role             = aws_iam_role.pii_audio_api_handler_function.arn
  handler          = "dist/index.handler"
  source_code_hash = filesha256("${local.pii_audio_api_handler_function_path}/${local.lambda_zip_file_name}")

  runtime = "nodejs20.x"

  environment {
    variables = {
      // Transcribe audio recordings lambda
      AUDIO_BUCKET          = aws_s3_bucket.audio.id
      TRANSCRIPTIONS_BUCKET = aws_s3_bucket.transcriptions.id
      PII_ENTITIES          = join(",", local.pii_entities)
      MEDIA_FORMAT          = local.media_format
      DEFAULT_LANGUAGE_CODE = local.default_language_code

      // Analyze audio recordings lambda
      SLACK_NOTIFICATIONS_WEBHOOK     = local.slack_notification_webhook
      AWS_TRANSCRIBE_REDACTED_PII_TAG = "[PII]" // This is the tag that is used if any PII is found in the transcription
      redacter_function_name          = try(aws_lambda_function.pii_audio_redacter_function[0].function_name, null)

      CURRENT_LAMBDA_NAME   = local.redacter_function_name
      REDACT_ORIGINAL_AUDIO = local.redact_original_audio
    }
  }
}

resource "aws_lambda_function" "pii_audio_redacter_function" {
  count            = local.redact_original_audio ? 1 : 0
  filename         = "${local.redact_audio_processor_lambda_path}/${local.lambda_zip_file_name}"
  function_name    = local.redacter_function_name
  role             = aws_iam_role.redact_pii_audio_recording_lambda.arn
  handler          = "app.lambda_handler"
  source_code_hash = filesha256("${local.redact_audio_processor_lambda_path}/${local.lambda_zip_file_name}")

  timeout = 300

  runtime = "python3.12"

  # Attach the FFmpeg layer
  layers = [aws_lambda_layer_version.ffmpeg_layer.arn]

  environment {
    variables = {
      AUDIO_BUCKET = aws_s3_bucket.audio.id
    }
  }
}

resource "aws_iam_role" "pii_audio_api_handler_function" {
  name               = "pii_audio_api_handler_function_role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json
}

resource "aws_iam_role" "redact_pii_audio_recording_lambda" {
  name               = "redact_pii_audio_recording_lambda_role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json
}

data "aws_iam_policy_document" "lambda_assume_role" {
  statement {
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }

    actions = ["sts:AssumeRole"]
  }
}

resource "aws_iam_policy" "pii_audio_api_handler_function" {
  name        = "${local.api_handler_function_name}-policy"
  description = "Policy to allow the API handler function to interact with S3 and Transcribe"
  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ],
        Effect   = "Allow",
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Action = [
          "s3:PutObject",
          "s3:Get*",
          "s3:ListBucket"
        ],
        Effect = "Allow",
        Resource = [
          aws_s3_bucket.audio.arn,
          "${aws_s3_bucket.audio.arn}/*",
          aws_s3_bucket.transcriptions.arn,
          "${aws_s3_bucket.transcriptions.arn}/*"
        ]
      },
      {
        Action = [
          "transcribe:StartTranscriptionJob"
        ],
        Effect = "Allow",
        Resource = [
          "*"
        ]
      }
    ]
  })
}

resource "aws_iam_policy" "pii_audio_api_handler_invoke_function" {
  count       = local.redact_original_audio ? 1 : 0
  name        = "${local.api_handler_function_name}-invoke-function-policy"
  description = "Policy to allow invoking the PII audio redacter function"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = [
          "lambda:InvokeFunction"
        ],
        Effect = "Allow",
        Resource = [
          aws_lambda_function.pii_audio_redacter_function[0].arn
        ]
      }
    ]
  })
}

resource "aws_iam_policy" "redact_pii_audio_recording_lambda" {
  name        = "redact_pii_audio_recording_lambda_policy"
  description = "Default policy for the redact PII audio recording lambda"
  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ],
        Effect   = "Allow",
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Action = [
          "s3:PutObject",
          "s3:Get*",
        ],
        Effect = "Allow",
        Resource = [
          aws_s3_bucket.audio.arn,
          "${aws_s3_bucket.audio.arn}/*"
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "pii_audio_api_handler_function" {
  role       = aws_iam_role.pii_audio_api_handler_function.name
  policy_arn = aws_iam_policy.pii_audio_api_handler_function.arn
}

resource "aws_iam_role_policy_attachment" "invoke_lambda_policy_attachment" {
  count      = local.redact_original_audio ? 1 : 0
  role       = aws_iam_role.pii_audio_api_handler_function.name
  policy_arn = aws_iam_policy.pii_audio_api_handler_invoke_function[0].arn
}

resource "aws_iam_role_policy_attachment" "redact_pii_audio_recording_lambda" {
  role       = aws_iam_role.redact_pii_audio_recording_lambda.name
  policy_arn = aws_iam_policy.redact_pii_audio_recording_lambda.arn
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

resource "aws_lambda_function_url" "pii_audio_api_handler_function" {
  function_name      = aws_lambda_function.pii_audio_api_handler_function.function_name
  authorization_type = local.api_authorization_type
}

resource "aws_lambda_layer_version" "ffmpeg_layer" {
  filename   = "${local.redact_audio_processor_lambda_path}/layer/ffmpeg.zip"
  layer_name = "ffmpeg"
}
