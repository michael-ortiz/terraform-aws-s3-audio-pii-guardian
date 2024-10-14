# s3-audio-recordings-pii-analyzer

This project allows you to provision the necesary infrastructure to enable you to detect PII information in audio voice recordings stored in S3.

You have the option to automatically run PII detection jobs when a new audio file is inserted in S3, or automatically, trigger PII analysis jobs using HTTP API.

We leverage on [AWS Transcribe](https://aws.amazon.com/pm/transcribe) Services to handle the [detection of PII](https://docs.aws.amazon.com/transcribe/latest/dg/pii-redaction.html) information.

# Architecture

## Use Case 1: Automatic Detection on New Objects in S3

<img width="1353" alt="Screenshot 2024-10-13 at 9 31 19 PM" src="https://github.com/user-attachments/assets/b9eea3c3-a628-455e-a715-cb923f02c1f8">

## Use Case 2: Manual Trigger on Existing S3 Objects using API

<img width="820" alt="Screenshot 2024-10-13 at 9 31 33 PM" src="https://github.com/user-attachments/assets/1f4903b7-c644-420d-a7bd-f9f2c21e2ae1">

# Automatic Analysis

Steps: Insert audio audio recording in S3 bucket:

```
audio-recordings-bucket-####
```

You must specify the audio file extension in `configs.tf`. Default value is `.wav`.


## Configuration

Head over to `configs.tf` to see all options before you deploy. You can use default values, or modify them per your needs.

## Deployment

This is a Terraform project that you can use and test out on your own.

Be sure to have [Terraform](https://developer.hashicorp.com/terraform/tutorials/aws-get-started/install-cli) and [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) installed.

To deploy the infrastrcuture, run:

```sh
terraform init
terraform apply
```

## Modying Lambdas

You can optionally modify the lambdas to your needs. 

To build and deploy a lambda, execute the following commands:

```
make build-lambdas
terraform apply
```

# API

Get API urls from Terraform Output.

## Transcribe Existing Audio Recording in S3 and Identify + Redact PII

**Method:** `POST`

**URL**: Get actual URL from Terraform Output.

Example:
```
https://{ID}.lambda-url.us-east-1.on.aws/transcribe
```

**Body:**
```
{
  "s3ObjectKeys": [
    "{AUDIO_FILE_NAME}.wav"
  ],
  languageCode: "en-US", // Optionally, override default language
}
```

**Response:**
```
{
    "startedJobs": [
        {
            "jobId": "34def188-a1b8-4ed7-9822-4f1bf763bfd0",
            "s3ObjectKey": "{AUDIO_FILE_NAME}.wav",
            "s3Uri": "s3://audio-recordings-bucket-####/{AUDIO_FILE_NAME}.wav"
        }
    ],
    "jobErrors": []
}
```


## Check for PII in Audio Recording in S3

Method: `GET`

**URL**: Get actual URL from Terraform Output.

Example:
```
https://{ID}.lambda-url.us-east-1.on.aws/analyze/{S3_OBJECT_KEY}
```

**Response:**

```
{
    "message": "PII detected in call recording",
    "containsPII": true,
    "audioUri": "s3://audio-recordings-bucket-####/{AUDIO_FILE_NAME}",
    "transcriptUri": "s3://audio-recordings-pii-transcriptions-bucket-####/{AUDIO_FILE_NAME}",
    "transcript": "Hello, my name is [PII]. My credit card number is [PII]. My social security is [PII]."
}
```
