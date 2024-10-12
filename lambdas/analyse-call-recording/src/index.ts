import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
const client = new S3Client({ region: "us-east-1" });

export const handler = async (event: any, context: any) => {

  const s3_bucket = event.Records[0].s3.bucket.name
  const s3_key = event.Records[0].s3.object.key

  const params = {
    Bucket: s3_bucket,
    Key: s3_key
  };

  const data = await client.send(new GetObjectCommand(params));

  const bodyContents = await streamToString(data.Body);

  if (bodyContents.includes(process.env.AWS_TRANSCRIBE_REDACTED_PII_TAG!)) {

    console.log("PII detected in", s3_key);

    const sanitizedKey1 = s3_key.replace("redacted-", '');
    const sanitizedKey2 = s3_key.replace(".json", '');

    console.log("Sending notification to Slack", process.env.SLACK_NOTIFICATIONS_WEBHOOK!);

    await fetch(process.env.SLACK_NOTIFICATIONS_WEBHOOK!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ text: `PII detected in Call Recording: **${sanitizedKey2}**. \n\nBucket: **${s3_bucket}**` })
    }).catch((err) => {
      console.error("Error sending notification to Slack", err);
    } );
  }

  return null;
};

async function streamToString(stream: any) : Promise<string> {
  return new Promise((resolve, reject) => {
      const chunks: Uint8Array[] = [];
      stream.on("data", (chunk: Uint8Array) => chunks.push(chunk));
      stream.on("error", reject);
      stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
  });
}