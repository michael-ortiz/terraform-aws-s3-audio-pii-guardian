import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { LambdaClient, InvokeCommand, InvocationType } from "@aws-sdk/client-lambda";

const s3Client = new S3Client({ region: "us-east-1" });
const lambdaClient = new LambdaClient({ region: "us-east-1" });

export const handler = async (event: any, context: any) => {

  const transcriptionsBucket = process.env.RECORDINGS_TRANSCRIPTIONS_S3_BUCKET_NAME!;
  const audioBucket = process.env.AUDIO_RECORDINGS_S3_BUCKET_NAME!;
  
  let s3_key: string = "";

  try {

    // S3 event
    if (event.Records) {
      s3_key = event.Records[0].s3.object.key
    }
    // API Gateway event 
    else if (event.queryStringParameters && event.queryStringParameters.s3ObjectKey) {
      // The s3 key is prefixed with "redacted-" and suffixed with ".json"
      s3_key = `redacted-${event.queryStringParameters.s3ObjectKey}.json`
    }
    else {
      throw new Error("No s3 object key found in event")
    }

    const originalObjectKey = getOriginalObjectKey(s3_key);

    const params = {
      Bucket: transcriptionsBucket,
      Key: s3_key
    };

    const data = await s3Client.send(new GetObjectCommand(params));

    if (!data) {
      throw { message: "No object key found" };
    }

    const parsedBody = JSON.parse(await streamToString(data.Body));
    const transcript = parsedBody.results.transcripts[0].transcript;

    // Check if the body contains the redacted PII tag
    if (transcript.includes(process.env.AWS_TRANSCRIBE_REDACTED_PII_TAG!)) {

      await sendSlackNotification(s3_key, transcriptionsBucket);

      // Call Lambda function to redact PII in the audio recording
      await redactAudioRecording(s3_key, getPIITimeStamps(parsedBody));

      return {
        statusCode: 200,
        body: JSON.stringify({
          message: "PII detected in call recording",
          containsPII: true,
          audioUri: `s3://${audioBucket}/${originalObjectKey}`,
          redactedAudioUri: `s3://${audioBucket}/redacted/${originalObjectKey}`,
          transcriptUri: `s3://${transcriptionsBucket}/${s3_key}`
        })
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "No PII detected in call recording",
        containsPII: false,
        audioUri: `s3://${audioBucket}/${originalObjectKey}`,
        transcriptUri: `s3://${transcriptionsBucket}/${s3_key}`
      })
    }

  } catch (err) {

    console.error({
      message: "Error analyzing call recording",
      error: err
    })

    return {
      statusCode: 400,
      body: JSON.stringify({
        message: "Error analyzing call recording",
        audioUri: `s3://${audioBucket}/${s3_key}`,
        error: err
      })
    }
  }
};

async function redactAudioRecording(s3ObjectKey: string, muteTimeStamps: any): Promise<void> {

  const sanitizedKey = s3ObjectKey.replace("redacted-", '').replace(".json", '');

  const lambdaParams = {
    FunctionName: process.env.REDACT_AUDIO_PROCESSOR_LAMBDA_NAME,
    InvocationType: InvocationType.Event,
    Payload: JSON.stringify({
      s3ObjectKey: sanitizedKey,
      muteTimeStamps: muteTimeStamps
    })
  };

  await lambdaClient.send(new InvokeCommand(lambdaParams));

}

async function sendSlackNotification(objectKey: string, bucketName: string): Promise<void> {

  if (!process.env.SLACK_NOTIFICATIONS_WEBHOOK || process.env.SLACK_NOTIFICATIONS_WEBHOOK === "") {
    return;
  }

  const sanitizedKey = objectKey.replace("redacted-", '').replace(".json", '');

  await fetch(process.env.SLACK_NOTIFICATIONS_WEBHOOK!, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ text: `PII detected in Call Recording:\n\nKey: *${sanitizedKey}*.\n\nBucket: *${bucketName}*` })
  }).catch((err) => {
    console.error({
      message: "Error sending notification to Slack",
      err
    });
  });
}

async function streamToString(stream: any): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    stream.on("data", (chunk: Uint8Array) => chunks.push(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
  });
}

function getPIITimeStamps(data: any) : { start_time: string, end_time: string }[] {

  if (data.results.items.length === 0) {
    return [];
  }

  let piiTimeStamps: { start_time: string, end_time: string }[] = [];

  for (const transcript of data.results.items) {

    if (transcript.alternatives[0].content === process.env.AWS_TRANSCRIBE_REDACTED_PII_TAG!) {
      piiTimeStamps.push({
        start_time: transcript.start_time,
        end_time: transcript.end_time
      });
    }
  }

  return piiTimeStamps;
}

function getOriginalObjectKey(s3ObjectKey: string): string {
  return s3ObjectKey.replace("redacted-", '').replace(".json", '');
}
  
