install-packages:
	npm --prefix lambdas/pii-audio-api-handler install

build-lambdas:
	make install-packages && npm run --prefix lambdas/pii-audio-api-handler build
	cd lambdas/pii-audio-redactor && zip lambda.zip app.py > /dev/null

deploy:
	cd terraform && terraform init && terraform apply