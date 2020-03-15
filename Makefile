.PHONY: local deploy

local:
	hugo server

deploy:
	hugo --minify
	aws s3 sync public s3://www.lambdasawa.net --delete --acl public-read
	aws cloudfront create-invalidation --distribution-id ${HUGO_cloudFrontDistributionID} --paths "/*"

open:
	open https://www.lambdasawa.net/
