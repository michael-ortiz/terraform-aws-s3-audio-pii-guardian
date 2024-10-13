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
exports.AnalyzeService = void 0;
const client_lambda_1 = require("@aws-sdk/client-lambda");
const client_s3_1 = require("@aws-sdk/client-s3");
const NotificationService_1 = require("./NotificationService");
const Utils_1 = require("../utils/Utils");
const TranscribeService_1 = require("./TranscribeService");
class AnalyzeService {
    constructor() {
        // Initialize clients
        this.s3Client = new client_s3_1.S3Client({ region: "us-east-1" });
        this.lambdaClient = new client_lambda_1.LambdaClient({ region: "us-east-1" });
        this.notifications = new NotificationService_1.NotificationService();
    }
    analyzeAudioRecording(s3ObjectKey, eventType) {
        return __awaiter(this, void 0, void 0, function* () {
            const transcriptionsBucket = process.env.TRANSCRIPTIONS_BUCKET;
            const audioBucket = process.env.AUDIO_BUCKET;
            const originalObjectKey = (0, Utils_1.getOriginalObjectKey)(s3ObjectKey);
            const params = {
                Bucket: transcriptionsBucket,
                Key: eventType === TranscribeService_1.EventType.S3 ? s3ObjectKey : `redacted-${s3ObjectKey}.json`
            };
            try {
                const data = yield this.s3Client.send(new client_s3_1.GetObjectCommand(params));
                if (!data) {
                    throw { message: "No object key found" };
                }
                const parsedBody = JSON.parse(yield this.streamToString(data.Body));
                const transcript = parsedBody.results.transcripts[0].transcript;
                // Check if the body contains the redacted PII tag
                if (transcript.includes(process.env.AWS_TRANSCRIBE_REDACTED_PII_TAG)) {
                    yield this.notifications.sendSlackNotification(s3ObjectKey, transcriptionsBucket);
                    // Call Lambda function to redact PII in the audio recording
                    yield this.redactAudioRecording(originalObjectKey, this.getPIITimeStamps(parsedBody));
                    return {
                        message: "PII detected in call recording. Call will be redacted.",
                        containsPII: true,
                        audioUri: `s3://${audioBucket}/${originalObjectKey}`,
                        transcriptUri: `s3://${transcriptionsBucket}/${s3ObjectKey}`,
                        transcript: transcript
                    };
                }
                return {
                    message: "No PII detected in call recording",
                    containsPII: false,
                    audioUri: `s3://${audioBucket}/${originalObjectKey}`,
                    transcriptUri: `s3://${transcriptionsBucket}/${s3ObjectKey}`
                };
            }
            catch (error) {
                const errorMessage = { message: "Error analyzing audio recording", error };
                console.error(errorMessage);
                return errorMessage;
            }
        });
    }
    redactAudioRecording(s3ObjectKey, muteTimeStamps) {
        return __awaiter(this, void 0, void 0, function* () {
            const lambdaParams = {
                FunctionName: process.env.REDACT_AUDIO_PROCESSOR_LAMBDA_NAME,
                InvocationType: client_lambda_1.InvocationType.Event,
                Payload: JSON.stringify({
                    s3ObjectKey: s3ObjectKey,
                    muteTimeStamps: muteTimeStamps
                })
            };
            try {
                // Invoke the lambda function
                yield this.lambdaClient.send(new client_lambda_1.InvokeCommand(lambdaParams));
            }
            catch (error) {
                console.error({
                    message: "Error invoking redact audio processor lambda",
                    object: s3ObjectKey,
                    error
                });
            }
        });
    }
    streamToString(stream) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                const chunks = [];
                stream.on("data", (chunk) => chunks.push(chunk));
                stream.on("error", reject);
                stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
            });
        });
    }
    getPIITimeStamps(data) {
        if (data.results.items.length === 0) {
            return [];
        }
        let piiTimeStamps = [];
        for (const transcript of data.results.items) {
            if (transcript.alternatives[0].content === process.env.AWS_TRANSCRIBE_REDACTED_PII_TAG) {
                piiTimeStamps.push({
                    start_time: transcript.start_time,
                    end_time: transcript.end_time
                });
            }
        }
        return piiTimeStamps;
    }
}
exports.AnalyzeService = AnalyzeService;
