# aws-s3-audio-pii-guardian 🔒

# Description 🏁

This is an open source project tht allows you to provision the necesary infrastructure to enable you to detect PII information in audio voice recordings stored in S3.

You have the option to automatically run PII (Personal Identifiable Information) detection jobs when a new audio file is inserted in S3, or automatically, trigger PII analysis jobs using HTTP API for existing objects.

We leverage on [AWS Transcribe](https://aws.amazon.com/pm/transcribe) service to handle the [detection of PII](https://docs.aws.amazon.com/transcribe/latest/dg/pii-redaction.html) information.

If PII is detected, a process will redact and mute the PII information in the original audio file using [FFmpeg](https://www.ffmpeg.org/). You can optionally turn this feature off in the `configs.tf` settings.

# PII Supported Detection Types 🕵️

Below are the types of information that AWS Transcribe can detct:

* ADDRESS
* BANK_ACCOUNT_NUMBER
* BANK_ROUTING
* CREDIT_DEBIT_CVV
* CREDIT_DEBIT_EXPIRY
* CREDIT_DEBIT_NUMBER
* EMAIL
* NAME
* PHONE
* PIN
* SSN

You can optionally configure the data you want to detect and redact in `configs.tf`

# Architecture 🏗️

## Services Used

* AWS S3 (storage)
* AWS Lambda (backend)
* AWS Transribe (transcriptions + PII detection)

## Use Case 1: Automatic Detection on New Objects in S3

<img width="1353" alt="Screenshot 2024-10-13 at 9 31 19 PM" src="https://github.com/user-attachments/assets/b9eea3c3-a628-455e-a715-cb923f02c1f8">

## Use Case 2: Manual Trigger on Existing S3 Objects using API

<img width="820" alt="Screenshot 2024-10-13 at 9 31 33 PM" src="https://github.com/user-attachments/assets/1f4903b7-c644-420d-a7bd-f9f2c21e2ae1">

# Automatic Analysis

Steps: Insert audio audio recording in S3 bucket.

```
audio-bucket-####
```

You must specify the audio file extension in `configs.tf`. Default value is `.wav`.


# Configuration

Head over to `configs.tf` to see all options before you deploy. You can use default values, or modify them per your needs.

# Deployment 🚀

This is a Terraform project that you can use and test out on your own.

Be sure to have [Terraform](https://developer.hashicorp.com/terraform/tutorials/aws-get-started/install-cli) and [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) installed.

To deploy the infrastrcuture, run:

```sh
terraform init
terraform apply
```

# Modying Lambdas 📝

You can optionally modify the lambdas to your needs. 

To build and deploy a lambda, execute the following commands:

```
make build-lambdas
terraform apply
```

# API 👨‍💻

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
  languageCode: "en-US", // Optionally, overwrite default language
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
    {
    "message": "PII detected in call recording.",
    "containsPII": true,
    "redactOriginalAudio": true,
    "audioUri": "s3://audio-bucket-####/{S3_OBJECT_KEY}",
    "transcriptUri": "s3://audio-transcriptions-bucket-####/{S3_OBJECT_KEY}",
    "transcriptText": "Hello, my name is [PII]. Uh This is a test uh testing uh test card information. My credit card number is [PII] [PII]. My social security is [PII]. This is test data.",
    "piiIdentifications": [
        {
            "type": "[PII]",
            "start_time": "2.43",
            "end_time": "2.93",
            "redactions": [
                {
                    "confidence": "1.0",
                    "type": "NAME",
                    "category": "PII"
                }
            ]
        },
        {
            "type": "[PII]",
            "start_time": "11.55",
            "end_time": "13.569",
            "redactions": [
                {
                    "confidence": "0.9994",
                    "type": "CREDIT_DEBIT_NUMBER",
                    "category": "PII"
                }
            ]
        },
        {
            "type": "[PII]",
            "start_time": "14.439",
            "end_time": "19.729",
            "redactions": [
                {
                    "confidence": "0.9994",
                    "type": "CREDIT_DEBIT_NUMBER",
                    "category": "PII"
                }
            ]
        },
        {
            "type": "[PII]",
            "start_time": "22.36",
            "end_time": "27.129",
            "redactions": [
                {
                    "confidence": "0.9999",
                    "type": "SSN",
                    "category": "PII"
                }
            ]
        }
    ]
}
}
```

# Cost of Usage 💰

Pricing varies based on usage and is based on pay-as-you-go model. Be sure you understand the pricing before you use the services at scale.

## AWS Transcribe Pricing

As of October 13, 2024 for `us-east-1`. 

See [Amazon Transcribe Pricing](https://aws.amazon.com/transcribe/pricing/) for most up to date pricing.

Since we will transcribe calls and also redact PII, both pricings will apply.

### Standard Pricing
<img width="870" alt="Screenshot 2024-10-14 at 11 37 24 AM" src="https://github.com/user-attachments/assets/fa0fda3a-3a5c-4a85-998f-6174482e028f">

### PII Redaction Pricing
<img width="850" alt="Screenshot 2024-10-13 at 9 38 59 PM" src="https://github.com/user-attachments/assets/2d4ff751-bf80-43c6-9495-f8305ad2b99b">

## AWS S3 Pricing

See [AWS S3 Pricing](https://aws.amazon.com/s3/pricing/)

## Lambda Pricing

See [AWS Lambda Pricing](https://aws.amazon.com/lambda/pricing/)


