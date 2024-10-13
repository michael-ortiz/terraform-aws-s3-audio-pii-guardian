// Define the configuration for the infrastructure

locals {

  // Trigger the transcription of the audio recordings when they are put on S3 automatically
  analyse_audio_recording_on_s3_put = true

  // Define the suffix for the audio files
  audio_file_suffix_suffix          = ".wav"

  // Define the suffix for the transcriptions file
  transcriptions_file_suffix        = ".json"

  // Optional: Set webhook for Slack notifications
  slack_notification_webhook        = ""

  // Define the PII entities that we want to detect
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