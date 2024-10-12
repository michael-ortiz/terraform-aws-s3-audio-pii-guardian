# s3-audio-recordings-pii-analyzer

# Automatic Analysis

Steps: Insert audio audio recording in S3 bucket:

```
audio-recordings-bucket-####
```

You must specify the audio file extension in `configs.tf`. Default value is `.wav`.

# Receive Slack Notification

Set your webhook url on `configs.tf`, `slack_notification_webhook` local variable.

# API

Get API urls from Terraform Output.

## Transcribe Audio Recording in S3 and redact PII

Method: `GET`

```
{transcribe_audio_recordings_lambda_url}/?s3ObjectKey={FILE_NAME}.wav
```

## Check for PII in Audio Recording in S3

Method: `GET`

```
{analyze_audio_recordings_lambda_url}/?s3ObjectKey={FILE_NAME}.wav
```