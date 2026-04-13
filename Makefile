.PHONY: help prepare deploy prepare-deploy dev serve watch

SHELL := /usr/bin/env bash
DEPLOY_DIR := $(shell pwd)/deploy

# Registry config
include $(DEPLOY_DIR)/.registry.env

# Auto-generated image tag: YYYYMMDD-sha
TAG_DATE := $(shell date +%Y%m%d)
TAG_SHA  := $(shell git rev-parse --short HEAD 2>/dev/null || echo unknown)
IMAGE_TAG := $(REGISTRY)/$(ALIYUN_NAMESPACE)/polaris:$(TAG_DATE)-$(TAG_SHA)

# ---------------------------------------------------------------------------
# Help
# ---------------------------------------------------------------------------
help:
	@echo "Usage: make <target>"
	@echo ""
	@echo "Deploy (2-step):"
	@echo "  prepare                  Build web, download binary, build & push image"
	@echo "  deploy ENV=local         Deploy to local Docker"
	@echo "  deploy ENV=jdc           Deploy to JDC"
	@echo "  prepare-deploy           Both steps in one go"
	@echo ""
	@echo "Development:"
	@echo "  dev    Build web and start server (static)"
	@echo "  serve  Polaris API server only"
	@echo "  watch  Vue dev server with HMR"
	@echo ""
	@echo "Options:"
	@echo "  IMAGE_TAG=...  Override auto-generated image tag"

default: help

# ===================================================================
# Step 1: Prepare image
# ===================================================================
prepare:
	@ENV=$${ENV:-local}; \
	bash $(DEPLOY_DIR)/prepare-image.sh "$$ENV"

# ===================================================================
# Step 2: Deploy
# ===================================================================
deploy:
	@if [ -z "$(ENV)" ]; then \
		echo "Error: ENV required. Usage: make deploy ENV=local|jdc"; \
		exit 1; \
	fi
	@bash $(DEPLOY_DIR)/deploy.sh $(ENV) "$(IMAGE_TAG)"

# ===================================================================
# Convenience: both steps
# ===================================================================
prepare-deploy: prepare deploy

# ===================================================================
# Dev targets
# ===================================================================
dev:
	cd web && npm run build
	cd server && cargo run -- -f -w ../web/dist

serve:
	cd server && cargo run -- -f

watch:
	cd web && npm run dev
