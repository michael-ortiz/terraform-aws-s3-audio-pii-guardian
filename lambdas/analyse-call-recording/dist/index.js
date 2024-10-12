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
    const s3_bucket = event.Records[0].s3.bucket.name;
    const s3_key = event.Records[0].s3.object.key;
    const params = {
        Bucket: s3_bucket,
        Key: s3_key
    };
    const data = yield client.send(new client_s3_1.GetObjectCommand(params));
    const bodyContents = yield streamToString(data.Body);
    if (bodyContents.includes(process.env.AWS_TRANSCRIBE_REDACTED_PII_TAG)) {
        console.log("PII detected in", s3_key);
        yield fetch(process.env.SLACK_NOTIFICATIONS_WEBHOOK, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ text: `PII detected in bucket ${s3_bucket}, key ${s3_key}` })
        });
    }
    return null;
});
exports.handler = handler;
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
