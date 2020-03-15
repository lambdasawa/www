.PHONY: local deploy

local:
	hugo server

deploy:
	hugo
	hugo deploy
