.PHONY: local deploy

local:
	hugo server

deploy:
	hugo --minify
	hugo deploy --force
	aws cloudfront create-invalidation --distribution-id ${HUGO_cloudFrontDistributionID} --paths "/*"

