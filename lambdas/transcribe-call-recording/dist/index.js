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
const transcribeClient = new client_transcribe_1.TranscribeClient({ region: 'us-east-1' });
const handler = (event, context) => __awaiter(void 0, void 0, void 0, function* () {
    const s3_bucket = event.Records[0].s3.bucket.name;
    const s3_key = event.Records[0].s3.object.key;
    console.log(`S3 bucket: ${s3_bucket} S3 key: ${s3_key}`);
    const s3Uri = `s3://${s3_bucket}/${s3_key}`;
    // Remove the file extension from the key
    const sanitizedKey = s3_key.replace(/\.[^/.]+$/, "");
    // Set the parameters
    const params = {
        TranscriptionJobName: sanitizedKey,
        LanguageCode: "en-US", // For example, 'en-US'
        MediaFormat: "wav",
        Media: {
            MediaFileUri: s3Uri,
        },
        OutputBucketName: process.env.TRANSCRIPTIONS_S3_BUCKET_NAME,
        OutputKey: `${sanitizedKey}.json`,
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
    try {
        const data = yield transcribeClient.send(new client_transcribe_1.StartTranscriptionJobCommand(params));
        console.log("Success", data);
        return data; // For unit tests.
    }
    catch (err) {
        console.log("Error", err);
    }
});
exports.handler = handler;
