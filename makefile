build-lambdas:
	npm run --prefix lambdas/analyse-audio-recording build
	npm run --prefix lambdas/transcribe-audio-recording build
	cd lambdas/redact-audio-processor && zip lambda.zip app.py
