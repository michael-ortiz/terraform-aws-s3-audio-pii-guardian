data "aws_caller_identity" "current" {}

variable "audio_bucket_name" {
  description = "The name of the S3 bucket to store the audio recordings"
  type        = string
  default     = "aduio-recordings-bucket"
}

variable "transcriptions_bucket_name" {
  description = "The name of the S3 bucket to store the transcriptions results"
  type        = string
  default     = "transcriptions-bucket"
}