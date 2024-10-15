import { InvocationType, InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { NotificationService } from "./NotificationService";
import { getOriginalObjectKey } from "../utils/Utils";
import { EventType } from "./TranscribeService";
import { AnalyzeResponse, ErrorResponse, IdentificationResults, MuteTimestamps } from "../interfaces/Interfaces";


export class AnalyzeService {

  private readonly s3Client: S3Client;
  private readonly lambdaClient: LambdaClient;
  private readonly notifications: NotificationService;

  constructor() {

    // Initialize clients
    this.s3Client = new S3Client({ region: process.env.AWS_REGION });
    this.lambdaClient = new LambdaClient({ region: process.env.AWS_REGION });
    this.notifications = new NotificationService();
  }

  async analyzeAudioRecording(s3ObjectKey: string, eventType: EventType): Promise<AnalyzeResponse | ErrorResponse> {

    const transcriptionsBucket = process.env.TRANSCRIPTIONS_BUCKET!;
    const audioBucket = process.env.AUDIO_BUCKET!;
    const originalObjectKey = getOriginalObjectKey(s3ObjectKey);

    const params = {
      Bucket: transcriptionsBucket,
      Key: eventType === EventType.S3 ? s3ObjectKey : `redacted-${s3ObjectKey}.json`
    };

    try {

      const transcriptResponse = await this.s3Client.send(new GetObjectCommand(params));

      if (!transcriptResponse) {
        throw { message: "No object key found" };
      }

      const parsedBody = JSON.parse(await this.streamToString(transcriptResponse.Body));
      const transcriptText = parsedBody.results.transcripts[0].transcript;

      // Check if the transcription contains the redacted PII tag
      if (transcriptText.includes(process.env.AWS_TRANSCRIBE_REDACTED_PII_TAG!)) {


        if (process.env.REDACT_AUDIO === "true") {
          // Call Lambda function to redact PII in the audio recording
          await this.redactAudioRecording(originalObjectKey, this.getPiiIdentificationTimeStamps(parsedBody));
        }
        
        const response = {
          message: "PII detected in call recording.",
          containsPII: true,
          redactOriginalAudio: process.env.REDACT_AUDIO === "true",
          audioUri: `s3://${audioBucket}/${originalObjectKey}`,
          transcriptUri: `s3://${transcriptionsBucket}/${s3ObjectKey}`,
          transcriptText: transcriptText,
          piiIdentifications: this.getTranscriptionPiiIdentificationResults(parsedBody)
        }

        await this.notifications.sendWebhookNotification(response);
        await this.notifications.sendSlackNotification(s3ObjectKey, transcriptionsBucket);

        return response;
      }

      // No PII detected
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
      FunctionName: process.env.REDACTOR_FUNCTION_NAME!,
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

  private getPiiIdentificationTimeStamps(data: any): MuteTimestamps[] {

    if (data.results.items.length === 0) {
      return [];
    }

    let piiTimeStamps: MuteTimestamps[] = [];

    const results = this.getTranscriptionPiiIdentificationResults(data);

    for (const result of results) {
      if (result.type === process.env.AWS_TRANSCRIBE_REDACTED_PII_TAG!) {
        piiTimeStamps.push({
          start_time: result.start_time,
          end_time: result.end_time
        });
      }
    }

    return piiTimeStamps;
  }

  private getTranscriptionPiiIdentificationResults(data: any): IdentificationResults[] {

    if (data.results.items.length === 0) {
      return [];
    }

    const results: IdentificationResults[] = [];

    // Loop through the transcription results and check for PII
    // Redacted PII is tagged as '[PII]'
    for (const transcript of data.results.items) {
      for (const alternative of transcript.alternatives) {
        if (alternative.content === process.env.AWS_TRANSCRIBE_REDACTED_PII_TAG!) {
          results.push({
            type: alternative.content,
            start_time: transcript.start_time,
            end_time: transcript.end_time,
            redactions: alternative.redactions
          });
        }
      }
    }

    return results;
  }
}

