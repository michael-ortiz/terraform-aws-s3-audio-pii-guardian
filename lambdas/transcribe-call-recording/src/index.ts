
import { StartTranscriptionJobCommand, StartTranscriptionJobCommandInput, TranscribeClient } from "@aws-sdk/client-transcribe";
import { v4 as uuidv4 } from 'uuid';

const transcribeClient = new TranscribeClient({ region: 'us-east-1' });

export const handler = async (event: any, context: any) => {

  const s3_bucket = event.Records[0].s3.bucket.name
  const s3_key = event.Records[0].s3.object.key

  console.log(`S3 bucket: ${s3_bucket} S3 key: ${s3_key}`)

  const s3Uri = `s3://${s3_bucket}/${s3_key}`

  const jobId = uuidv4();

  // Set the parameters
  const params : StartTranscriptionJobCommandInput = {
    TranscriptionJobName: jobId,
    LanguageCode: "en-US", // For example, 'en-US'
    MediaFormat: "wav",
    Media: {
      MediaFileUri: s3Uri,
    },
    OutputBucketName: process.env.TRANSCRIPTIONS_S3_BUCKET_NAME,
    OutputKey: `${jobId}.json`,
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

  try {
    const data = await transcribeClient.send(
      new StartTranscriptionJobCommand(params)
    );
    console.log("Success", data);
    return data; // For unit tests.
  } catch (err) {
    console.log("Error", err);
  }
};