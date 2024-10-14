import express, { Request, Response } from 'express';
import ServerlessHttp from 'serverless-http';
import { AnalyzeService } from './services/AnalyzeService';
import { EventType, TranscribeService } from './services/TranscribeService';
import { APIGatewayEvent, S3EventRecord } from 'aws-lambda';

const app = express();
app.use(express.json())

const analyzeService = new AnalyzeService();
const transcribeService = new TranscribeService();

app.post('/transcribe', async (req: Request, res: Response) => {

  console.log(JSON.stringify(req.body));

  const response = await transcribeService.transcribeAudioRecording(
    req.body.s3ObjectKeys,
    req.body.languageCode
  )

  res.json(response);
});

app.get('/analyze/:objectKey', async (req: Request, res: Response) => {

  const response = await analyzeService.analyzeAudioRecording(req.params.objectKey, EventType.API);

  res.json(response);
});

const handler = ServerlessHttp(app);

// Handler for S3 events
const s3EventHandler = async (records: S3EventRecord[]) => {

  for (const record of records) {

    if (record.eventSource !== "aws:s3") {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: "Event source is not S3"
        })
      }
    }

    const objectKey = record.s3.object.key;

    if (record.userIdentity.principalId.includes(process.env.CURRENT_LAMBDA_NAME!)) {
      // Skip if the event source is the current lambda function as this event is only 
      // triggered when re overriding the original audio redacted audio file.
      // We don't want to trigger the transcription job again when the redacted audio file is uploaded.
      const response = {
        event: "SKIPPED_S3_EVENT",
        objectKey,
        message: "Event source is the current lambda function"
      }
      console.log(response);
      return {
        statusCode: 200,
        body: JSON.stringify(response)
      }
    }

    if (record.s3.bucket.name == process.env.AUDIO_BUCKET) {

      const response = await transcribeService.transcribeAudioRecording([objectKey]);

      return {
        statusCode: 200,
        body: JSON.stringify(response),
      }
    }

    if (record.s3.bucket.name == process.env.TRANSCRIPTIONS_BUCKET) {

      const objectKey = record.s3.object.key;
      const response = await analyzeService.analyzeAudioRecording(objectKey, EventType.S3);

      return {
        statusCode: 200,
        body: JSON.stringify(response),
      }
    }
  }
};

const startServer = async () => {
  app.listen(3000, () => {
    console.log("listening on port 3000!");
  });
}

startServer();

module.exports.handler = (event: any, context: any, _callback: any) => {

  console.log(JSON.stringify(event));

  // Call the handler for S3 events
  if (event.Records && event.Records.length > 0) {
    return s3EventHandler(event.Records);
  }

  // Call the handler for API calls
  return handler(event, context);;
};