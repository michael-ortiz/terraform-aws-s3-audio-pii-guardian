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
const client = new client_s3_1.S3Client({ region: "us-east-1" });
const handler = (event, context) => __awaiter(void 0, void 0, void 0, function* () {
    const s3_bucket = process.env.RECORDINGS_TRANSCRIPTIONS_S3_BUCKET_NAME;
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
        const params = {
            Bucket: s3_bucket,
            Key: s3_key
        };
        const data = yield client.send(new client_s3_1.GetObjectCommand(params));
        if (!data) {
            throw { message: "No object key found" };
        }
        const bodyContents = yield streamToString(data.Body);
        // Check if the body contains the redacted PII tag
        if (bodyContents.includes(process.env.AWS_TRANSCRIBE_REDACTED_PII_TAG)) {
            yield sendSlackNotification(s3_key, s3_bucket);
            return {
                message: "PII detected in call recording",
                containsPII: true,
                bucket: s3_bucket,
                key: s3_key,
            };
        }
        return {
            message: "No PII detected in call recording",
            containsPII: false,
            bucket: s3_bucket,
            key: s3_key,
        };
    }
    catch (err) {
        console.error({
            message: "Error analyzing call recording",
            error: err
        });
        return {
            message: "Error analyzing call recording",
            bucket: s3_bucket,
            key: s3_key,
            error: err
        };
    }
});
exports.handler = handler;
function sendSlackNotification(objectKey, bucketName) {
    return __awaiter(this, void 0, void 0, function* () {
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
