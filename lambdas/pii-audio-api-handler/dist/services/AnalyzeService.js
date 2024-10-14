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
        this.s3Client = new client_s3_1.S3Client({ region: process.env.AWS_REGION });
        this.lambdaClient = new client_lambda_1.LambdaClient({ region: process.env.AWS_REGION });
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
                const transcriptResponse = yield this.s3Client.send(new client_s3_1.GetObjectCommand(params));
                if (!transcriptResponse) {
                    throw { message: "No object key found" };
                }
                const parsedBody = JSON.parse(yield this.streamToString(transcriptResponse.Body));
                const transcriptText = parsedBody.results.transcripts[0].transcript;
                // Check if the transcription contains the redacted PII tag
                if (transcriptText.includes(process.env.AWS_TRANSCRIBE_REDACTED_PII_TAG)) {
                    yield this.notifications.sendSlackNotification(s3ObjectKey, transcriptionsBucket);
                    if (process.env.REDACT_ORIGINAL_AUDIO === "true") {
                        // Call Lambda function to redact PII in the audio recording
                        yield this.redactAudioRecording(originalObjectKey, this.getPiiIdentificationTimeStamps(parsedBody));
                    }
                    return {
                        message: "PII detected in call recording.",
                        containsPII: true,
                        redactOriginalAudio: process.env.REDACT_ORIGINAL_AUDIO === "true",
                        audioUri: `s3://${audioBucket}/${originalObjectKey}`,
                        transcriptUri: `s3://${transcriptionsBucket}/${s3ObjectKey}`,
                        transcriptText: transcriptText,
                        piiIdentifications: this.getTranscriptionPiiIdentificationResults(parsedBody)
                    };
                }
                // No PII detected
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
                FunctionName: process.env.redacter_function_name,
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
    getPiiIdentificationTimeStamps(data) {
        if (data.results.items.length === 0) {
            return [];
        }
        let piiTimeStamps = [];
        const results = this.getTranscriptionPiiIdentificationResults(data);
        for (const result of results) {
            if (result.type === process.env.AWS_TRANSCRIBE_REDACTED_PII_TAG) {
                piiTimeStamps.push({
                    start_time: result.start_time,
                    end_time: result.end_time
                });
            }
        }
        return piiTimeStamps;
    }
    getTranscriptionPiiIdentificationResults(data) {
        if (data.results.items.length === 0) {
            return [];
        }
        const results = [];
        // Loop through the transcription results and check for PII
        // Redacted PII is tagged as '[PII]'
        for (const transcript of data.results.items) {
            for (const alternative of transcript.alternatives) {
                if (alternative.content === process.env.AWS_TRANSCRIBE_REDACTED_PII_TAG) {
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
exports.AnalyzeService = AnalyzeService;
