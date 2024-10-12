
import { StartTranscriptionJobCommand, StartTranscriptionJobCommandInput, TranscribeClient } from "@aws-sdk/client-transcribe";
import { v4 as uuidv4 } from 'uuid';

const transcribeClient = new TranscribeClient({ region: 'us-east-1' });

interface Jobs {
  jobId: string,
  s3Uri: string
  error?: any
}

export const handler = async (event: any, context: any) => {

  let s3_key;
  let s3ObjectKeys: string[] = [];
  const startedJobs: Jobs[] = [];
  const failedJobs: Jobs[] = [];

  if (event.Records) {

    s3_key = event.Records[0].s3.object.key

    s3ObjectKeys = event.Records.map((record: any) => {
      return record.s3.object.key
    })

  } else if (event.queryStringParameters) {
    s3_key = event.queryStringParameters.s3ObjectKey
    s3ObjectKeys.push(s3_key);
  } else {
    throw new Error("No s3 object key found in event")
  }

  // Start a transcription job for each object key
  for (const s3ObjectKey of s3ObjectKeys) {

    const jobId = uuidv4()
    const s3Uri = `s3://${process.env.RECORDINGS_S3_BUCKET_NAME}/${s3ObjectKey}`

    try {

      // Set the parameters
      const params: StartTranscriptionJobCommandInput = {
        TranscriptionJobName: jobId,
        LanguageCode: "en-US", // For example, 'en-US'
        MediaFormat: "wav",
        Media: {
          MediaFileUri: s3Uri,
        },
        OutputBucketName: process.env.TRANSCRIPTIONS_S3_BUCKET_NAME,
        OutputKey: `${s3ObjectKey}.json`,
        ContentRedaction: {
          RedactionType: "PII",
          PiiEntityTypes: [
            "SSN",
            "CREDIT_DEBIT_NUMBER",
            "CREDIT_DEBIT_EXPIRY",
            "CREDIT_DEBIT_CVV",
            "PIN",
            "BANK_ROUTING",
            "BANK_ACCOUNT_NUMBER"
          ],
          RedactionOutput: "redacted"
        }
      };

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