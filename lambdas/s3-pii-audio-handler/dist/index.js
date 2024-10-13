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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const serverless_http_1 = __importDefault(require("serverless-http"));
const AnalyzeService_1 = require("./services/AnalyzeService");
const TranscribeService_1 = require("./services/TranscribeService");
const app = (0, express_1.default)();
app.use(express_1.default.json());
const analyzeService = new AnalyzeService_1.AnalyzeService();
const transcribeService = new TranscribeService_1.TranscribeService();
app.post('/transcribe', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    console.log(JSON.stringify(req.body));
    const response = yield transcribeService.transcribeAudioRecording(req.body.s3ObjectKeys, req.body.languageCode);
    res.json(response);
}));
app.get('/analyze/:objectKey', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const response = yield analyzeService.analyzeAudioRecording(req.params.objectKey, TranscribeService_1.EventType.API);
    res.json(response);
}));
const handler = (0, serverless_http_1.default)(app);
// Handler for S3 events
const s3EventHandler = (records) => __awaiter(void 0, void 0, void 0, function* () {
    for (const record of records) {
        const objectKey = record.s3.object.key;
        if (record.bucket.name == process.env.AUDIO_BUCKET) {
            const response = yield transcribeService.transcribeAudioRecording(objectKey);
            return {
                statusCode: 200,
                body: JSON.stringify(response),
            };
        }
        if (record.bucket.name == process.env.TRANSCRIPTIONS_BUCKET) {
            const objectKey = record.s3.object.key;
            const response = yield analyzeService.analyzeAudioRecording(objectKey, TranscribeService_1.EventType.S3);
            return {
                statusCode: 200,
                body: JSON.stringify(response),
            };
        }
    }
});
const startServer = () => __awaiter(void 0, void 0, void 0, function* () {
    app.listen(3000, () => {
        console.log("listening on port 3000!");
    });
});
startServer();
module.exports.handler = (event, context, _callback) => {
    // Call the handler for S3 events
    if (event.Records && event.Records.length > 0) {
        return s3EventHandler(event.Records);
    }
    // Call the handler for API calls
    return handler(event, context);
    ;
};
