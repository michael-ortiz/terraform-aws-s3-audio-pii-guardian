import os
import json
import boto3

s3 = boto3.client('s3')

def lambda_handler(event, context):
    
    bucket_name =  os.environ.get('RECORDINGS_S3_BUCKET_NAME')
    s3_object_key = event.get('s3ObjectKey')
    mute_time_stamps = event.get('muteTimeStamps')

    # Validate the input
    if not s3_object_key:
        return {
            "statusCode": 400,
            "body": json.dumps({
                "error": "object_key is required"
            })
        }
    
    if not mute_time_stamps:
        return {
            "statusCode": 400,
            "body": json.dumps({
                "error": "time_stamps is required"
            })
        }
    
    # Download Path
    audio_file = f'/tmp/{s3_object_key}'
    saved_file = f'/tmp/redacted-{s3_object_key}'
    
    # Download the file from S3
    s3.download_file(bucket_name, s3_object_key, audio_file)

    # Create a filter string to mute the audio between the time stamps
    filter_string = ",".join([f"volume=enable='between(t,{ts['start_time']},{ts['end_time']})':volume=0" for ts in mute_time_stamps])

    # Apply the filter to the audio file
    os.system(f"/opt/bin/ffmpeg -i {audio_file} -af \"{filter_string}\" {saved_file}")
    
    # Upload the redacted file to S3
    s3.upload_file(saved_file, bucket_name, s3_object_key)

    return {
        "statusCode": 200,
        "headers": {
            "Content-Type": "application/json"
        },
        "body": json.dumps({
            "message": "Audio redacted successfully",
            "s3_bucket ": bucket_name,
            "s3_key": s3_object_key
        })
    }