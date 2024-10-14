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
exports.TranscribeService = exports.EventType = void 0;
const uuid_1 = require("uuid");
const client_transcribe_1 = require("@aws-sdk/client-transcribe");
var EventType;
(function (EventType) {
    EventType["S3"] = "s3";
    EventType["API"] = "api";
})(EventType || (exports.EventType = EventType = {}));
class TranscribeService {
    constructor() {
        this.transcribeClient = new client_transcribe_1.TranscribeClient({ region: process.env.AWS_REGION });
    }
    transcribeAudioRecording(s3ObjectKeys, languageCode) {
        return __awaiter(this, void 0, void 0, function* () {
            let startedJobs = [];
            let failedJobs = [];
            languageCode = languageCode || process.env.DEFAULT_LANGUAGE_CODE;
            for (const s3ObjectKey of s3ObjectKeys) {
                const jobId = (0, uuid_1.v4)();
                const s3Uri = `s3://${process.env.AUDIO_BUCKET}/${s3ObjectKey}`;
                try {
                    // Set the parameters
                    const params = {
                        TranscriptionJobName: jobId,
                        LanguageCode: languageCode,
                        MediaFormat: process.env.MEDIA_FORMAT,
                        Media: {
                            MediaFileUri: s3Uri,
                        },
                        OutputBucketName: process.env.TRANSCRIPTIONS_BUCKET,
                        OutputKey: `${s3ObjectKey}.json`,
                        ContentRedaction: {
                            RedactionType: "PII",
                            PiiEntityTypes: process.env.PII_ENTITIES.split(","),
                            RedactionOutput: "redacted"
                        }
                    };
                    yield this.transcribeClient.send(new client_transcribe_1.StartTranscriptionJobCommand(params));
                    // Add the job to the started jobs array
                    const response = {
                        message: `Transcription job started successfully`,
                        jobId: jobId,
                        s3Uri: s3Uri
                    };
                    console.log(response);
                    startedJobs.push(response);
                }
                catch (err) {
                    const errorResponse = {
                        message: `Error starting transcription job. Make sure object exists in the bucket.`,
                        jobId: jobId,
                        s3Uri: s3Uri,
                        error: err
                    };
                    console.error(errorResponse);
                    failedJobs.push(errorResponse);
                }
            }
            return {
                startedJobs: startedJobs,
                jobErrors: failedJobs
            };
        });
    }
}
exports.TranscribeService = TranscribeService;
