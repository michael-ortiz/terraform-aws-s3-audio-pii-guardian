# s3-audio-recordings-pii-analyzer

This project allows you to provision the necesary infrastructure to enable you to detect PII information in audio voice recordings stored in S3.

You have the option to automatically run PII detection jobs when a new audio file is inserted in S3, or automatically, trigger PII analysis jobs using HTTP API.

We leverage on [AWS Transcribe](https://aws.amazon.com/pm/transcribe) Services to handle the [detection of PII](https://docs.aws.amazon.com/transcribe/latest/dg/pii-redaction.html) information.

# Architecture

Note: SNS Notifications Pending

## Use Case 1: Automatic Detection on New Objects in S3
<img width="1361" alt="architecture-usecase-1" src="https://github.com/user-attachments/assets/441755a6-c0e7-4fea-8e44-86c565b32de5">


## Use Case 2: Manual Trigger on Existing S3 Objects using API

<img width="690" alt="architecture-usecase-2" src="https://github.com/user-attachments/assets/11e1d03a-3015-4fa9-8cef-77455aa5de83">

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
npm run --prefix lambdas/{LAMBDA_FOLDER_NAME} build
terraform apply
```

# API

Get API urls from Terraform Output.

## Transcribe Existing Audio Recording in S3 and Identify + Redact PII

**Method:** `POST`

**URL**: Get actual URL from Terraform Output.

Example:
```
https://{ID}.lambda-url.us-east-1.on.aws
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
https://{ID}.lambda-url.us-east-1.on.aws?s3ObjectKey={AUDIO_FILE_NAME}.wav
```
