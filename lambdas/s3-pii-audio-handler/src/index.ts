import express, { Request, Response } from 'express';
import ServerlessHttp from 'serverless-http';
import { AnalyzeService } from './services/AnalyzeService';
import { EventType, TranscribeService } from './services/TranscribeService';
import { stat } from 'fs';

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
const s3EventHandler = async (records: any) => {

  for (const record of records) {

    const objectKey = record.s3.object.key;

    if (record.bucket.name == process.env.AUDIO_BUCKET) {

      const response = await transcribeService.transcribeAudioRecording(objectKey);

      return {
        statusCode: 200,
        body: JSON.stringify(response),
      }
    }

    if (record.bucket.name == process.env.TRANSCRIPTIONS_BUCKET) {

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

  // Call the handler for S3 events
  if (event.Records && event.Records.length > 0) {
    return s3EventHandler(event.Records);
  }

  // Call the handler for API calls
  return handler(event, context);;
};