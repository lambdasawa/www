.PHONY: start open new deploy

start:
	hugo server

open:
	open http://localhost:1313/

new:
	hugo new posts/${TITLE}.md

deploy:
	hugo --minify
	cd infra && npm i && npm run cdk -- deploy
