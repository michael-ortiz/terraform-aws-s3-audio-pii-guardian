export function getOriginalObjectKey(s3ObjectKey: string): string {
  return s3ObjectKey.replace("redacted-", '').replace(".json", '');
}