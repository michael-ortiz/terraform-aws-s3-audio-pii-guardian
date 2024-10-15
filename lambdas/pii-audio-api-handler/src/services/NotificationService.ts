import { AnalyzeResponse } from "../interfaces/Interfaces";

export class NotificationService {

  constructor() { }

  // TODO: Add more notification services

  async sendWebhookNotification(response: AnalyzeResponse): Promise<void> {

    if (!this.isWebhookURLValid(process.env.NOTIFICATIONS_WEBHOOK_URL)) {
      return;
    }

    await fetch(process.env.NOTIFICATIONS_WEBHOOK_URL!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(response)
    }).catch((err) => {
      console.error({
        message: "Error sending notification to webhook",
        err
      });
    });

    return;
  }

  async sendSlackNotification(objectKey: string, bucketName: string): Promise<void> {

    if (!this.isWebhookURLValid(process.env.SLACK_NOTIFICATIONS_WEBHOOK)) {
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

  private isWebhookURLValid(url: string | undefined): boolean {
    return url !== undefined && url !== "";
  }
}

