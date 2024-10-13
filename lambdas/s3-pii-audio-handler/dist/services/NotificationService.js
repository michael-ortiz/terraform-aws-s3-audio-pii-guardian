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
exports.NotificationService = void 0;
class NotificationService {
    constructor() { }
    sendSlackNotification(objectKey, bucketName) {
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
}
exports.NotificationService = NotificationService;
