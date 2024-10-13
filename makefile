build-lambdas:
	npm run --prefix lambdas/s3-pii-audio-handler build
	cd lambdas/redact-audio-processor && zip lambda.zip app.py
