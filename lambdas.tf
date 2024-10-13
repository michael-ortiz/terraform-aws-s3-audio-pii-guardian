locals {
  transcribe_audio_recordings_lambda_path = "${path.module}/lambdas/transcribe-call-recording/Archive.zip"
  analyse_audio_recordings_lambda_path    = "${path.module}/lambdas/analyse-call-recording/Archive.zip"
}

resource "aws_lambda_function" "transcribe_audio_recordings_lambda" {
  filename         = local.transcribe_audio_recordings_lambda_path
  function_name    = "transcribe-audio-recordings-function"
  role             = aws_iam_role.transcribe_audio_recordings_lambda.arn
  handler          = "dist/index.handler"
  source_code_hash = filesha256(local.transcribe_audio_recordings_lambda_path)

  runtime = "nodejs20.x"

  environment {
    variables = {
      RECORDINGS_S3_BUCKET_NAME     = aws_s3_bucket.audio_recordings.id
      TRANSCRIPTIONS_S3_BUCKET_NAME = aws_s3_bucket.audio_recordings_transcriptions.id
      PII_ENTITIES                  = join(",", local.pii_entities)
    }
  }
}

resource "aws_lambda_function" "analyse_audio_recordings_lambda" {
  filename         = local.analyse_audio_recordings_lambda_path
  function_name    = "analyse-audio-recordings-function"
  role             = aws_iam_role.analyse_audio_recordings_lambda.arn
  handler          = "dist/index.handler"
  source_code_hash = filesha256(local.analyse_audio_recordings_lambda_path)

  runtime = "nodejs20.x"

  environment {
    variables = {
      RECORDINGS_TRANSCRIPTIONS_S3_BUCKET_NAME = aws_s3_bucket.audio_recordings_transcriptions.id
      SLACK_NOTIFICATIONS_WEBHOOK              = local.slack_notification_webhook
      AWS_TRANSCRIBE_REDACTED_PII_TAG          = "[PII]" // This is the tag that is used if any PII is found in the transcription
    }
  }
}

resource "aws_iam_role" "transcribe_audio_recordings_lambda" {
  name               = "transcribe_audio_recordings_lambda_role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json
}

resource "aws_iam_role" "analyse_audio_recordings_lambda" {
  name               = "analyse_audio_recordings_lambda_role"
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

resource "aws_iam_policy" "transcribe_audio_recordings_lambda" {
  name        = "transcribe_audio_recordings_lambda_policy"
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

resource "aws_iam_policy" "analyse_audio_recordings_lambda" {
  name        = "s3_recordings_analyse_trigger_policy"
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
          "s3:GetObject",
          "s3:ListBucket"
        ],
        Effect = "Allow",
        Resource = [
          aws_s3_bucket.audio_recordings_transcriptions.arn,
          "${aws_s3_bucket.audio_recordings_transcriptions.arn}/*"
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "transcribe_audio_recordings_lambda" {
  role       = aws_iam_role.transcribe_audio_recordings_lambda.name
  policy_arn = aws_iam_policy.transcribe_audio_recordings_lambda.arn
}

resource "aws_iam_role_policy_attachment" "analyse_audio_recordings_lambda" {
  role       = aws_iam_role.analyse_audio_recordings_lambda.name
  policy_arn = aws_iam_policy.analyse_audio_recordings_lambda.arn
}

## Lambda Permissions

resource "aws_lambda_permission" "s3_recordings_trigger_permission" {
  statement_id  = "AllowExecutionFromS3Bucket"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.transcribe_audio_recordings_lambda.arn
  principal     = "s3.amazonaws.com"
  source_arn    = aws_s3_bucket.audio_recordings.arn
}

resource "aws_lambda_permission" "s3_recordings_transcriptions_trigger_permission" {
  statement_id  = "AllowExecutionFromS3Bucket"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.analyse_audio_recordings_lambda.arn
  principal     = "s3.amazonaws.com"
  source_arn    = aws_s3_bucket.audio_recordings_transcriptions.arn
}

resource "aws_lambda_function_url" "transcribe_audio_recordings_lambda" {
  function_name      = aws_lambda_function.transcribe_audio_recordings_lambda.function_name
  authorization_type = "NONE" // Change this to "AWS_IAM" if you want to secure the endpoint
}

resource "aws_lambda_function_url" "analyse_audio_recordings_lambda" {
  function_name      = aws_lambda_function.analyse_audio_recordings_lambda.function_name
  authorization_type = "NONE" // Change this to "AWS_IAM" if you want to secure the endpoint
}

output "transcribe_audio_recordings_lambda_url" {
  value = aws_lambda_function_url.transcribe_audio_recordings_lambda.function_url
}

output "analyze_audio_recordings_lambda_url" {
  value = aws_lambda_function_url.analyse_audio_recordings_lambda.function_url
}
