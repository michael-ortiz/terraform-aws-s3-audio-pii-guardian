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
const client_s3_1 = require("@aws-sdk/client-s3");
const client_lambda_1 = require("@aws-sdk/client-lambda");
const s3Client = new client_s3_1.S3Client({ region: "us-east-1" });
const lambdaClient = new client_lambda_1.LambdaClient({ region: "us-east-1" });
const handler = (event, context) => __awaiter(void 0, void 0, void 0, function* () {
    const transcriptionsBucket = process.env.RECORDINGS_TRANSCRIPTIONS_S3_BUCKET_NAME;
    const audioBucket = process.env.AUDIO_RECORDINGS_S3_BUCKET_NAME;
    let s3_key = "";
    try {
        // S3 event
        if (event.Records) {
            s3_key = event.Records[0].s3.object.key;
        }
        // API Gateway event 
        else if (event.queryStringParameters && event.queryStringParameters.s3ObjectKey) {
            // The s3 key is prefixed with "redacted-" and suffixed with ".json"
            s3_key = `redacted-${event.queryStringParameters.s3ObjectKey}.json`;
        }
        else {
            throw new Error("No s3 object key found in event");
        }
        const originalObjectKey = getOriginalObjectKey(s3_key);
        const params = {
            Bucket: transcriptionsBucket,
            Key: s3_key
        };
        const data = yield s3Client.send(new client_s3_1.GetObjectCommand(params));
        if (!data) {
            throw { message: "No object key found" };
        }
        const parsedBody = JSON.parse(yield streamToString(data.Body));
        const transcript = parsedBody.results.transcripts[0].transcript;
        // Check if the body contains the redacted PII tag
        if (transcript.includes(process.env.AWS_TRANSCRIBE_REDACTED_PII_TAG)) {
            yield sendSlackNotification(s3_key, transcriptionsBucket);
            // Call Lambda function to redact PII in the audio recording
            yield redactAudioRecording(s3_key, getPIITimeStamps(parsedBody));
            return {
                statusCode: 200,
                body: JSON.stringify({
                    message: "PII detected in call recording",
                    containsPII: true,
                    audioUri: `s3://${audioBucket}/${originalObjectKey}`,
                    redactedAudioUri: `s3://${audioBucket}/redacted/${originalObjectKey}`,
                    transcriptUri: `s3://${transcriptionsBucket}/${s3_key}`
                })
            };
        }
        return {
            statusCode: 200,
            body: JSON.stringify({
                message: "No PII detected in call recording",
                containsPII: false,
                audioUri: `s3://${audioBucket}/${originalObjectKey}`,
                transcriptUri: `s3://${transcriptionsBucket}/${s3_key}`
            })
        };
    }
    catch (err) {
        console.error({
            message: "Error analyzing call recording",
            error: err
        });
        return {
            statusCode: 400,
            body: JSON.stringify({
                message: "Error analyzing call recording",
                audioUri: `s3://${audioBucket}/${s3_key}`,
                error: err
            })
        };
    }
});
exports.handler = handler;
function redactAudioRecording(s3ObjectKey, muteTimeStamps) {
    return __awaiter(this, void 0, void 0, function* () {
        const sanitizedKey = s3ObjectKey.replace("redacted-", '').replace(".json", '');
        const lambdaParams = {
            FunctionName: process.env.REDACT_AUDIO_PROCESSOR_LAMBDA_NAME,
            InvocationType: client_lambda_1.InvocationType.Event,
            Payload: JSON.stringify({
                s3ObjectKey: sanitizedKey,
                muteTimeStamps: muteTimeStamps
            })
        };
        yield lambdaClient.send(new client_lambda_1.InvokeCommand(lambdaParams));
    });
}
function sendSlackNotification(objectKey, bucketName) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!process.env.SLACK_NOTIFICATIONS_WEBHOOK || process.env.SLACK_NOTIFICATIONS_WEBHOOK === "") {
            return;
        }
        const sanitizedKey = objectKey.replace("redacted-", '').replace(".json", '');
        yield fetch(process.env.SLACK_NOTIFICATIONS_WEBHOOK, {
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
    });
}
function streamToString(stream) {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise((resolve, reject) => {
            const chunks = [];
            stream.on("data", (chunk) => chunks.push(chunk));
            stream.on("error", reject);
            stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
        });
    });
}
function getPIITimeStamps(data) {
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
function getOriginalObjectKey(s3ObjectKey) {
    return s3ObjectKey.replace("redacted-", '').replace(".json", '');
}
