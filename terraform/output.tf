output "api_url" {
  value = try(aws_lambda_function_url.pii_audio_api_handler_function[0].function_url, null)
}