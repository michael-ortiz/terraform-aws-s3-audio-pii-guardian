install-lambdas-dependencies:
	npm --prefix lambdas/pii-audio-api-handler install

build-lambdas:
	npm run --prefix lambdas/pii-audio-api-handler build

deploy:
	cd terraform && terraform init && terraform apply

create-ffmpeg-layer:
	cd lambdas/pii-audio-redactor && \
	rm -rf layer && \
  mkdir layer && cd layer && \
  wget https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz && \
  tar xvf ffmpeg-release-amd64-static.tar.xz && \
  mkdir -p ffmpeg/bin && \
  cp ffmpeg-*-amd64-static/ffmpeg ffmpeg/bin/ && \
  cd ffmpeg && zip -r ../ffmpeg.zip . && \
  cd .. && rm -rf ffmpeg ffmpeg-release-amd64-static.tar.xz ffmpeg-*-amd64-static