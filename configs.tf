// Define the configuration for the infrastructure

locals {

  // Trigger the transcription of the audio recordings when they are put on S3 automatically
  auto_s3_put_trigger = true

  redact_original_audio = true

  // Define a default language options for the audio transcription
  default_language_code = "en-US"
 
  // Define the format and file extension of the audio files in S3
  // Valid values: mp3, mp4, wav, flac, amr, ogg, and webm.
  media_format = "wav"

  // Define the suffix for the transcriptions file
  transcriptions_file_suffix        = ".json"

  // Optional: Set webhook for Slack notifications
  slack_notification_webhook        = ""

  // Define the PII entities that we want to detect
  // Properties defined here: https://docs.aws.amazon.com/transcribe/latest/dg/pii-redaction-batch.html
  pii_entities = [
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