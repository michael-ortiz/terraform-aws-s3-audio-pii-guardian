locals {
  transcribe_call_recording_lambda_path = "${path.module}/lambdas/transcribe-call-recording/Archive.zip"
  analyse_call_recording_lambda_path   = "${path.module}/lambdas/analyse-call-recording/Archive.zip"
}

resource "aws_lambda_function" "transcribe_call_recording_lambda" {
  filename         = local.transcribe_call_recording_lambda_path
  function_name    = "transcribe_call_recording_function"
  role             = aws_iam_role.transcribe_call_recording_lambda.arn
  handler          = "dist/index.handler"
  source_code_hash = filesha256(local.transcribe_call_recording_lambda_path)

  runtime = "nodejs20.x"

  environment {
    variables = {
      TRANSCRIPTIONS_S3_BUCKET_NAME = aws_s3_bucket.call_recordings_transcriptions.id
    }
  }
}

resource "aws_lambda_function" "analyse_call_recording_lambda" {
  filename         = local.analyse_call_recording_lambda_path
  function_name    = "analyse_call_recording_function"
  role             = aws_iam_role.analyse_call_recording_lambda.arn
  handler          = "dist/index.handler"
  source_code_hash = filesha256(local.analyse_call_recording_lambda_path)

  runtime = "nodejs20.x"

  environment {
    variables = {
      SLACK_NOTIFICATIONS_WEBHOOK     = ""
      AWS_TRANSCRIBE_REDACTED_PII_TAG = "[PII]" // This is the tag that is used if any PII is found in the transcription
    }
  }
}

resource "aws_iam_role" "transcribe_call_recording_lambda" {
  name               = "transcribe_call_recording_lambda_role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json
}

resource "aws_iam_role" "analyse_call_recording_lambda" {
  name               = "analyse_call_recording_lambda_role"
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

resource "aws_iam_policy" "transcribe_call_recording_lambda" {
  name        = "transcribe_call_recording_lambda_policy"
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
          "${aws_s3_bucket.call_recordings.arn}/*"
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

resource "aws_iam_policy" "analyse_call_recording_lambda" {
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
        ],
        Effect = "Allow",
        Resource = [
          "${aws_s3_bucket.call_recordings_transcriptions.arn}/*"
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "transcribe_call_recording_lambda" {
  role       = aws_iam_role.transcribe_call_recording_lambda.name
  policy_arn = aws_iam_policy.transcribe_call_recording_lambda.arn
}

resource "aws_iam_role_policy_attachment" "analyse_call_recording_lambda" {
  role       = aws_iam_role.analyse_call_recording_lambda.name
  policy_arn = aws_iam_policy.analyse_call_recording_lambda.arn
}

## Lambda Permissions

resource "aws_lambda_permission" "s3_recordings_trigger_permission" {
  statement_id  = "AllowExecutionFromS3Bucket"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.transcribe_call_recording_lambda.arn
  principal     = "s3.amazonaws.com"
  source_arn    = aws_s3_bucket.call_recordings.arn
}

resource "aws_lambda_permission" "s3_recordings_transcriptions_trigger_permission" {
  statement_id  = "AllowExecutionFromS3Bucket"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.analyse_call_recording_lambda.arn
  principal     = "s3.amazonaws.com"
  source_arn    = aws_s3_bucket.call_recordings_transcriptions.arn
}