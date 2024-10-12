import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
const client = new S3Client({ region: "us-east-1" });

export const handler = async (event: any, context: any) => {

  const s3_bucket = process.env.RECORDINGS_TRANSCRIPTIONS_S3_BUCKET_NAME!;
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

    const params = {
      Bucket: s3_bucket,
      Key: s3_key
    };

    const data = await client.send(new GetObjectCommand(params));

    if (!data) {
      throw { message: "No object key found" };
    }

    const bodyContents = await streamToString(data.Body);

    // Check if the body contains the redacted PII tag
    if (bodyContents.includes(process.env.AWS_TRANSCRIBE_REDACTED_PII_TAG!)) {

      await sendSlackNotification(s3_key, s3_bucket);

      return {
        message: "PII detected in call recording",
        containsPII: true,
        bucket: s3_bucket,
        key: s3_key,
      }
    }

    return {
      message: "No PII detected in call recording",
      containsPII: false,
      bucket: s3_bucket,
      key: s3_key,
    }

  } catch (err) {

    console.error({
      message: "Error analyzing call recording",
      error: err
    })

    return {
      message: "Error analyzing call recording",
      bucket: s3_bucket,
      key: s3_key,
      error: err
    }
  }
};

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