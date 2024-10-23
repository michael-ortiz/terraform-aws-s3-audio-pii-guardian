data "aws_caller_identity" "current" {}

variable "audio_bucket_name" {
  description = "The name of the S3 bucket to store the audio recordings"
  type        = string
  default     = "audio-bucket"
}

variable "transcriptions_bucket_name" {
  description = "The name of the S3 bucket to store the transcriptions results"
  type        = string
  default     = "transcriptions-bucket"
}

variable "auto_transcribe_on_s3_put" {
  description = "Automatically transcribe audio files when they are put into the S3 bucket"
  type        = bool
  default     = true
}

variable "auto_transcribe_probability_percent" {
  description = "Probability percentage to automatically transcribe audio files"
  type        = number
  default     = 100
}

variable "redact_audio" {
  description = "Will redact (mute) PII information in the audio recordings"
  type        = bool
  default     = true
}

variable "overwrite_original_audio" {
  description = "Overwrite the original audio file with the redacted version. If set to false, the redacted audio will be saved with -redacted suffix"
  type        = bool
  default     = false
}

variable "default_language_code" {
  description = "Define a default language options for the audio transcription"
  type        = string
  default     = "en-US"
}

variable "media_format" {
  description = "Define the format and file extension of the audio files in S3. Valid values: mp3, mp4, wav, flac, amr, ogg, and webm."
  type        = string
  default     = "wav"
}

variable "transcriptions_file_suffix" {
  description = "Define the suffix for the transcriptions file"
  type        = string
  default     = ".json"
}

variable "notification_webhook_url" {
  description = "Optional: Set a webhook for notifications. If not set, no notifications will be sent"
  type        = string
  default     = ""
}

variable "slack_notification_webhook_url" {
  description = "Optional: Set webhook for Slack notifications. If not set, no notifications will be sent"
  type        = string
  default     = ""
}

variable "pii_entities" {
  description = "Define the PII entities that we want to detect"
  type        = list(string)
  default     = [
    //"ALL",
    "ADDRESS",
    "BANK_ACCOUNT_NUMBER",
    "BANK_ROUTING",
    "CREDIT_DEBIT_CVV",
    "CREDIT_DEBIT_EXPIRY",
    "CREDIT_DEBIT_NUMBER",
    "EMAIL",
    "NAME",
    "PHONE",
    "PIN",
    "SSN",
  ]
}

variable "create_api_endpoint" {
  description = "Create an API endpoint to interact with the Handler function"
  type        = bool
  default     = true
}

variable "api_authorization_type" {
  description = "Options: 'AWS_IAM' or 'NONE'. Default: Will be open to the public (use with caution and for testing purposes only)"
  type        = string
  default     = "NONE"
}

variable "sentiment_analysis" {
  description = "Enable sentiment analysis on the transcriptions using Amazon Comprehend. This will incur additional costs"
  type        = bool
  default     = true
}