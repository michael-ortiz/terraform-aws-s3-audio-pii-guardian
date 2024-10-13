locals {
  s3_pii_audio_handler_lambda_path   = "${path.module}/lambdas/s3-pii-audio-handler"
  redact_audio_processor_lambda_path = "${path.module}/lambdas/redact-audio-processor"
}

resource "aws_lambda_function" "s3_pii_audio_handler_lambda" {
  filename         = "${local.s3_pii_audio_handler_lambda_path}/lambda.zip"
  function_name    = "s3-pii-audio-handler-function"
  role             = aws_iam_role.s3_pii_audio_handler_lambda.arn
  handler          = "dist/index.handler"
  source_code_hash = filesha256("${local.s3_pii_audio_handler_lambda_path}/lambda.zip")

  runtime = "nodejs20.x"

  environment {
    variables = {
      // Transcribe audio recordings lambda
      AUDIO_BUCKET          = aws_s3_bucket.audio_recordings.id
      TRANSCRIPTIONS_BUCKET = aws_s3_bucket.audio_recordings_transcriptions.id
      PII_ENTITIES          = join(",", local.pii_entities)
      MEDIA_FORMAT          = local.media_format
      DEFAULT_LANGUAGE_CODE = local.default_language_code

      // Analyze audio recordings lambda
      SLACK_NOTIFICATIONS_WEBHOOK        = local.slack_notification_webhook
      AWS_TRANSCRIBE_REDACTED_PII_TAG    = "[PII]" // This is the tag that is used if any PII is found in the transcription
      REDACT_AUDIO_PROCESSOR_LAMBDA_NAME = aws_lambda_function.pii_audio_redaction_lambda.function_name
    }
  }
}

resource "aws_lambda_function" "pii_audio_redaction_lambda" {
  filename         = "${local.redact_audio_processor_lambda_path}/lambda.zip"
  function_name    = "pii-audio-redaction-function"
  role             = aws_iam_role.redact_pii_audio_recording_lambda.arn
  handler          = "app.lambda_handler"
  source_code_hash = filesha256("${local.redact_audio_processor_lambda_path}/lambda.zip")

  timeout = 300

  runtime = "python3.12"

  # Attach the FFmpeg layer
  layers = [aws_lambda_layer_version.ffmpeg_layer.arn]

  environment {
    variables = {
      AUDIO_BUCKET = aws_s3_bucket.audio_recordings.id
    }
  }
}

resource "aws_iam_role" "s3_pii_audio_handler_lambda" {
  name               = "s3_pii_audio_handler_lambda_role"
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

resource "aws_iam_policy" "s3_pii_audio_handler_lambda" {
  name        = "s3_pii_audio_handler_lambda_policy"
  description = "Basic execution policy for Lambda"
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
          aws_s3_bucket.audio_recordings.arn,
          "${aws_s3_bucket.audio_recordings.arn}/*",
          aws_s3_bucket.audio_recordings_transcriptions.arn,
          "${aws_s3_bucket.audio_recordings_transcriptions.arn}/*"
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

resource "aws_iam_policy" "redact_pii_audio_recording_lambda" {
  name        = "redact_pii_audio_recording_lambda_policy"
  description = "Basic execution policy for Lambda"
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
          aws_s3_bucket.audio_recordings.arn,
          "${aws_s3_bucket.audio_recordings.arn}/*"
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "s3_pii_audio_handler_lambda" {
  role       = aws_iam_role.s3_pii_audio_handler_lambda.name
  policy_arn = aws_iam_policy.s3_pii_audio_handler_lambda.arn
}

resource "aws_iam_role_policy_attachment" "redact_pii_audio_recording_lambda" {
  role       = aws_iam_role.redact_pii_audio_recording_lambda.name
  policy_arn = aws_iam_policy.redact_pii_audio_recording_lambda.arn
}

## Lambda Permissions

resource "aws_lambda_permission" "s3_recordings_trigger_permission" {
  statement_id  = "AllowExecutionFromAudioS3Bucket"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.s3_pii_audio_handler_lambda.arn
  principal     = "s3.amazonaws.com"
  source_arn    = aws_s3_bucket.audio_recordings.arn
}

resource "aws_lambda_permission" "s3_recordings_transcriptions_trigger_permission" {
  statement_id  = "AllowExecutionFromTranscriptionsS3Bucket"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.s3_pii_audio_handler_lambda.arn
  principal     = "s3.amazonaws.com"
  source_arn    = aws_s3_bucket.audio_recordings_transcriptions.arn
}

resource "aws_lambda_function_url" "s3_pii_audio_handler_lambda" {
  function_name      = aws_lambda_function.s3_pii_audio_handler_lambda.function_name
  authorization_type = "NONE" // Change this to "AWS_IAM" if you want to secure the endpoint
}

output "s3_pii_audio_handler_lambda_function_url" {
  value = aws_lambda_function_url.s3_pii_audio_handler_lambda.function_url
}

resource "aws_lambda_layer_version" "ffmpeg_layer" {
  filename   = "${local.redact_audio_processor_lambda_path}/layer/ffmpeg.zip"
  layer_name = "ffmpeg"
}
