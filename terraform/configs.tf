// Define the configuration for the infrastructure

locals {

  // Trigger the transcription of the audio recordings when they are put on S3 automatically
  auto_transcribe_on_s3_put = true

  // Define a probability to automatically transcribe the audio recordings (0%-100%)
  // This can be used to only sample a percentage of the recordings
  // If set to 100, all recordings will be transcribed (use with caution and watch the costs in production environments)
  auto_transcribe_probability_percent = 100

  // Will redact (mute) PII information in the audio recordings
  redact_audio = true

  // Overwrite the original audio file with the redacted version
  // If set to false, the redacted audio will be saved with -redacted suffix
  overwrite_original_audio = false

  // Define a default language options for the audio transcription
  default_language_code = "en-US"

  // Define the format and file extension of the audio files in S3
  // Valid values: mp3, mp4, wav, flac, amr, ogg, and webm.
  media_format = "wav"

  // Define the suffix for the transcriptions file
  transcriptions_file_suffix = ".json"

  // Optional: Set a webhook for notifications. If not set, no notifications will be sent
  notification_webhook_url = ""

  // Optional: Set webhook for Slack notifications. If not set, no notifications will be sent
  slack_notification_webhook_url = ""

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

  // Options: "AWS_IAM" or "NONE"
  // Default: Will be open to the public (use with caution and for testing purposes only)
  api_authorization_type = "NONE"
}
