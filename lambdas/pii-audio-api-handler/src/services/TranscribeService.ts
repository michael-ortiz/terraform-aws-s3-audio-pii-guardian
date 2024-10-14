import { v4 as uuidv4 } from 'uuid';
import { LanguageCode, MediaFormat, PiiEntityType, StartTranscriptionJobCommand, StartTranscriptionJobCommandInput, TranscribeClient } from "@aws-sdk/client-transcribe";
import { Jobs, TranscriptionResponse } from '../interfaces/Interfaces';


export enum EventType {
  S3 = 's3',
  API = 'api'
}

export class TranscribeService {

  private readonly transcribeClient: TranscribeClient;

  constructor() {
    this.transcribeClient = new TranscribeClient({ region: process.env.AWS_REGION });
  }

  async transcribeAudioRecording(s3ObjectKeys: string[], languageCode?: string): Promise<TranscriptionResponse> {

    let startedJobs: Jobs[] = [];
    let failedJobs: Jobs[] = [];

    languageCode = languageCode || process.env.DEFAULT_LANGUAGE_CODE;

    for (const s3ObjectKey of s3ObjectKeys) {

      const jobId = uuidv4()
      const s3Uri = `s3://${process.env.AUDIO_BUCKET}/${s3ObjectKey}`

      try {

        // Set the parameters
        const params: StartTranscriptionJobCommandInput = {
          TranscriptionJobName: jobId,
          LanguageCode: languageCode as LanguageCode,
          MediaFormat: process.env.MEDIA_FORMAT as MediaFormat,
          Media: {
            MediaFileUri: s3Uri,
          },
          OutputBucketName: process.env.TRANSCRIPTIONS_BUCKET!,
          OutputKey: `${s3ObjectKey}.json`,
          ContentRedaction: {
            RedactionType: "PII",
            PiiEntityTypes: process.env.PII_ENTITIES!.split(",") as PiiEntityType[],
            RedactionOutput: "redacted"
          }
        };

        await this.transcribeClient.send(
          new StartTranscriptionJobCommand(params)
        );

        // Add the job to the started jobs array

        const response = {
          message: `Transcription job started successfully`,
          jobId: jobId,
          s3Uri: s3Uri
        }
        console.log(response);
        startedJobs.push(response);

      } catch (err) {

        const errorResponse = {
          message: `Error starting transcription job. Make sure object exists in the bucket.`,
          jobId: jobId,
          s3Uri: s3Uri,
          error: err
        }
        console.error(errorResponse);
        failedJobs.push(errorResponse);
      }
    }

    return {
      startedJobs: startedJobs,
      jobErrors: failedJobs
    }
  }
}