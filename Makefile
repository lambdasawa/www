.PHONY: local deploy

local:
	hugo server

deploy:
	hugo --minify
	cd infra && yarn cdk deploy

open:
	open https://www.lambdasawa.net/
