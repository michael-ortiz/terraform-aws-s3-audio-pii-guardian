"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const client_transcribe_1 = require("@aws-sdk/client-transcribe");
const uuid_1 = require("uuid");
const transcribeClient = new client_transcribe_1.TranscribeClient({ region: 'us-east-1' });
const handler = (event, context) => __awaiter(void 0, void 0, void 0, function* () {
    let s3_key;
    let s3ObjectKeys = [];
    const startedJobs = [];
    const failedJobs = [];
    if (event.Records) {
        s3_key = event.Records[0].s3.object.key;
        s3ObjectKeys = event.Records.map((record) => {
            return record.s3.object.key;
        });
    }
    else if (event.queryStringParameters) {
        s3_key = event.queryStringParameters.s3ObjectKey;
        s3ObjectKeys.push(s3_key);
    }
    else {
        throw new Error("No s3 object key found in event");
    }
    // Start a transcription job for each object key
    for (const s3ObjectKey of s3ObjectKeys) {
        const jobId = (0, uuid_1.v4)();
        const s3Uri = `s3://${process.env.RECORDINGS_S3_BUCKET_NAME}/${s3ObjectKey}`;
        try {
            // Set the parameters
            const params = {
                TranscriptionJobName: jobId,
                LanguageCode: "en-US", // For example, 'en-US'
                MediaFormat: "wav",
                Media: {
                    MediaFileUri: s3Uri,
                },
                OutputBucketName: process.env.TRANSCRIPTIONS_S3_BUCKET_NAME,
                OutputKey: `${s3ObjectKey}.json`,
                ContentRedaction: {
                    RedactionType: "PII",
                    PiiEntityTypes: [
                        "SSN",
                        "CREDIT_DEBIT_NUMBER",
                        "CREDIT_DEBIT_EXPIRY",
                        "CREDIT_DEBIT_CVV",
                        "PIN",
                        "BANK_ROUTING",
                        "BANK_ACCOUNT_NUMBER"
                    ],
                    RedactionOutput: "redacted"
                }
            };
            // Start the transcription job
            yield transcribeClient.send(new client_transcribe_1.StartTranscriptionJobCommand(params));
            // Add the job to the started jobs array
            startedJobs.push({
                jobId: jobId,
                s3Uri: s3Uri,
            });
            console.log({
                message: `Transcription job started successfully`,
                jobId: jobId,
                s3Uri: s3Uri
            });
        }
        catch (err) {
            failedJobs.push({
                jobId: jobId,
                s3Uri: s3Uri,
                error: err
            });
            console.error({
                message: `Error starting transcription job`,
                jobId: jobId,
                s3Uri: s3Uri,
                error: err
            });
        }
    }
    return {
        statusCode: 200,
        body: JSON.stringify({
            startedJobs: startedJobs,
            jobErrors: failedJobs
        })
    };
});
exports.handler = handler;
