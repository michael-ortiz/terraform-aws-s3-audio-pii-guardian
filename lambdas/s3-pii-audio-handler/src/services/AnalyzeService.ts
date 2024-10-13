import { InvocationType, InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { NotificationService } from "./NotificationService";
import { getOriginalObjectKey } from "../utils/Utils";
import { EventType } from "./TranscribeService";

export class AnalyzeService {

  private readonly s3Client: S3Client;
  private readonly lambdaClient: LambdaClient;
  private readonly notifications: NotificationService;

  constructor() {

    // Initialize clients
    this.s3Client = new S3Client({ region: "us-east-1" });
    this.lambdaClient = new LambdaClient({ region: "us-east-1" });
    this.notifications = new NotificationService();
  }

  async analyzeAudioRecording(s3ObjectKey: string, eventType: EventType) {

    const transcriptionsBucket = process.env.TRANSCRIPTIONS_BUCKET!;
    const audioBucket = process.env.AUDIO_BUCKET!;
    const originalObjectKey = getOriginalObjectKey(s3ObjectKey);

    const params = {
      Bucket: transcriptionsBucket,
      Key: eventType === EventType.S3 ? s3ObjectKey : `redacted-${s3ObjectKey}.json`
    };

    try {

      const data = await this.s3Client.send(new GetObjectCommand(params));

      if (!data) {
        throw { message: "No object key found" };
      }

      const parsedBody = JSON.parse(await this.streamToString(data.Body));
      const transcript = parsedBody.results.transcripts[0].transcript;

      // Check if the body contains the redacted PII tag
      if (transcript.includes(process.env.AWS_TRANSCRIBE_REDACTED_PII_TAG!)) {

        await this.notifications.sendSlackNotification(s3ObjectKey, transcriptionsBucket);


        if (process.env.REDACT_ORIGINAL_AUDIO === "true") {
          // Call Lambda function to redact PII in the audio recording
          await this.redactAudioRecording(originalObjectKey, this.getPIITimeStamps(parsedBody));
        }
      }

      return {
        message: "PII detected in call recording.",
        containsPII: true,
        redactOriginalAudio: process.env.REDACT_ORIGINAL_AUDIO === "true",
        audioUri: `s3://${audioBucket}/${originalObjectKey}`,
        transcriptUri: `s3://${transcriptionsBucket}/${s3ObjectKey}`,
        transcript: transcript
      }

      return {
        message: "No PII detected in call recording",
        containsPII: false,
        audioUri: `s3://${audioBucket}/${originalObjectKey}`,
        transcriptUri: `s3://${transcriptionsBucket}/${s3ObjectKey}`
      }

    } catch (error) {
      const errorMessage = { message: "Error analyzing audio recording", error }
      console.error(errorMessage);
      return errorMessage
    }
  }

  private async redactAudioRecording(s3ObjectKey: string, muteTimeStamps: any): Promise<void> {

    const lambdaParams = {
      FunctionName: process.env.REDACT_AUDIO_PROCESSOR_LAMBDA_NAME,
      InvocationType: InvocationType.Event,
      Payload: JSON.stringify({
        s3ObjectKey: s3ObjectKey,
        muteTimeStamps: muteTimeStamps
      })
    };

    try {
      // Invoke the lambda function
      await this.lambdaClient.send(new InvokeCommand(lambdaParams));
    } catch (error) {
      console.error({
        message: "Error invoking redact audio processor lambda",
        object: s3ObjectKey,
        error
      });
    }
  }

  private async streamToString(stream: any): Promise<string> {
    return new Promise((resolve, reject) => {
      const chunks: Uint8Array[] = [];
      stream.on("data", (chunk: Uint8Array) => chunks.push(chunk));
      stream.on("error", reject);
      stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    });
  }

  private getPIITimeStamps(data: any): { start_time: string, end_time: string }[] {

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
}