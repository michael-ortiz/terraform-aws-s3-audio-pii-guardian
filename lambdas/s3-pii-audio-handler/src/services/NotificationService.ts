export class NotificationService {

  constructor() { }

  async sendSlackNotification(objectKey: string, bucketName: string): Promise<void> {

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
}