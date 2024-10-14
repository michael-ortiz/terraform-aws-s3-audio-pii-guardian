build-lambdas:
	npm run --prefix lambdas/pii-audio-api-handler build
	cd lambdas/pii-audio-redacter && zip lambda.zip app.py
