
import { LanguageCode, MediaFormat, PiiEntityType, StartTranscriptionJobCommand, StartTranscriptionJobCommandInput, TranscribeClient } from "@aws-sdk/client-transcribe";
import { v4 as uuidv4 } from 'uuid';

const transcribeClient = new TranscribeClient({ region: 'us-east-1' });

interface Jobs {
  jobId: string,
  s3Uri: string
  error?: any
}

export const handler = async (event: any, context: any) => {

  let s3ObjectKeys: string[] = [];
  const startedJobs: Jobs[] = [];
  const failedJobs: Jobs[] = [];
  
  let languageCode = process.env.DEFAULT_LANGUAGE_CODE;

  if (event.Records) {

    // Get the s3 object keys from the event
    s3ObjectKeys = event.Records.map((record: any) => {
      return record.s3.object.key
    });

  } else if (event.body) {

    const body = JSON.parse(event.body);

    // Validate the body
    if (!body.s3ObjectKeys) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: "No s3 object keys found in body"
        })
      }
    }

    if (!Array.isArray(body.s3ObjectKeys)) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: "Expected s3 object keys to be an array"
        })
      }
    }

    if (body.s3ObjectKeys.length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: "Array of s3 object keys is empty"
        })
      }
    }

    // Get the s3 object keys from the body
    s3ObjectKeys = body.s3ObjectKeys.map((objectKey: any) => {
      return objectKey
    });

    // Get the language code from the body if it exists
    if (body.languageCode) {
      languageCode = body.languageCode;
    }

  } else {
    return {
      statusCode: 400,
      body: JSON.stringify({
        message: "No s3 object keys found in event or body"
      })
    }
  }

  // Start a transcription job for each object key
  for (const s3ObjectKey of s3ObjectKeys) {

    const jobId = uuidv4()
    const s3Uri = `s3://${process.env.RECORDINGS_S3_BUCKET_NAME}/${s3ObjectKey}`

    try {

      // Set the parameters
      const params: StartTranscriptionJobCommandInput = {
        TranscriptionJobName: jobId,
        LanguageCode: languageCode as LanguageCode,
        MediaFormat: process.env.MEDIA_FORMAT as MediaFormat,
        Media: {
          MediaFileUri: s3Uri,
        },
        OutputBucketName: process.env.TRANSCRIPTIONS_S3_BUCKET_NAME,
        OutputKey: `${s3ObjectKey}.json`,
        ContentRedaction: {
          RedactionType: "PII",
          PiiEntityTypes: process.env.PII_ENTITIES!.split(",") as PiiEntityType[],
          RedactionOutput: "redacted"
        }
      };

      console.log("PARAMS", params);

      // Start the transcription job
      await transcribeClient.send(
        new StartTranscriptionJobCommand(params)
      );

      // Add the job to the started jobs array
      startedJobs.push({
        jobId: jobId,
        s3Uri: s3Uri,
      });

      console.log({
        message: `Transcription job started successfully`,
        jobId: jobId,
        s3Uri: s3Uri
      });

    } catch (err) {

      failedJobs.push({
        jobId: jobId,
        s3Uri: s3Uri,
        error: err
      });

      console.error({
        message: `Error starting transcription job`,
        jobId: jobId,
        s3Uri: s3Uri,
        error: err
      });
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      startedJobs: startedJobs,
      jobErrors: failedJobs
    })
  };
};