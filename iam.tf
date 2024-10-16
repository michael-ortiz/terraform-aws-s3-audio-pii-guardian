## IAM Roles
resource "aws_iam_role" "pii_audio_api_handler_function" {
  name               = "${local.api_handler_function_name}-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json
}

resource "aws_iam_role" "redact_pii_audio_recording_lambda" {
  name               = "${local.redactor_function_name}-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json
}

## IAM Policies
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
        Effect = "Allow",
        Resource = [
          aws_cloudwatch_log_group.pii_audio_api_handler_log_group.arn,
          "${aws_cloudwatch_log_group.pii_audio_api_handler_log_group.arn}:*",
        ]
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
  count       = var.redact_audio ? 1 : 0
  name        = "${local.api_handler_function_name}-invoke-function-policy"
  description = "Policy to allow invoking the PII audio redactor function"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = [
          "lambda:InvokeFunction"
        ],
        Effect = "Allow",
        Resource = [
          aws_lambda_function.pii_audio_redactor_function[0].arn
        ]
      }
    ]
  })
}

resource "aws_iam_policy" "pii_audio_api_handler_comprehend_policy" {
  count       = var.sentiment_analysis ? 1 : 0
  name        = "${local.api_handler_function_name}-comprehend-policy"
  description = "Policy to allow invoking the Comprehend service"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = [
          "comprehend:DetectSentiment"
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
  name        = "${local.redactor_function_name}-policy"
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
        Effect = "Allow",
        Resource = [
          aws_cloudwatch_log_group.pii_audio_redactor_log_group.arn,
          "${aws_cloudwatch_log_group.pii_audio_redactor_log_group.arn}:*"
        ]
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

## IAM Role Policy Attachments
resource "aws_iam_role_policy_attachment" "pii_audio_api_handler_function" {
  role       = aws_iam_role.pii_audio_api_handler_function.name
  policy_arn = aws_iam_policy.pii_audio_api_handler_function.arn
}

resource "aws_iam_role_policy_attachment" "invoke_lambda_policy_attachment" {
  count      = var.redact_audio ? 1 : 0
  role       = aws_iam_role.pii_audio_api_handler_function.name
  policy_arn = aws_iam_policy.pii_audio_api_handler_invoke_function[0].arn
}

resource "aws_iam_role_policy_attachment" "redact_pii_audio_recording_lambda" {
  role       = aws_iam_role.redact_pii_audio_recording_lambda.name
  policy_arn = aws_iam_policy.redact_pii_audio_recording_lambda.arn
}

resource "aws_iam_role_policy_attachment" "comprehend_policy_attachment" {
  count      = var.sentiment_analysis ? 1 : 0
  role       = aws_iam_role.pii_audio_api_handler_function.name
  policy_arn = aws_iam_policy.pii_audio_api_handler_comprehend_policy[0].arn
}