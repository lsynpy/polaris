.PHONY: dev help

help:
	@echo "Usage: make <target>"
	@echo ""
	@echo "Targets:"
	@echo "  dev    Build web and start server (static, no HMR)"
	@echo "  serve  Polaris API server only"
	@echo "  watch  Vue dev server with HMR (requires Polaris running separately)"
	@echo "  help   Show this help message"

default: help

dev:
	cd web && npm run build
	cd server && cargo run -- -f -w ../web/dist

serve:
	cd server && cargo run -- -f

watch:
	cd web && npm run dev
