"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOriginalObjectKey = getOriginalObjectKey;
function getOriginalObjectKey(s3ObjectKey) {
    return s3ObjectKey.replace("redacted-", '').replace(".json", '');
}
