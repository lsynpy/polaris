#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

source "${SCRIPT_DIR}/.registry.env"

ENV="${1:-local}"
ENV_FILE="${SCRIPT_DIR}/.env.${ENV}"
if [[ -f "${ENV_FILE}" ]]; then
    source "${ENV_FILE}"
fi

# ---------------------------------------------------------------------------
# Tag scheme: date + short SHA
TAG_DATE="$(date +%Y%m%d)"
TAG_SHA="$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")"
IMAGE_TAG="${REGISTRY}/${ALIYUN_NAMESPACE}/polaris:${TAG_DATE}-${TAG_SHA}"

# Use ARCH from env file, or auto-detect
if [[ -z "${ARCH:-}" ]]; then
    case "$(uname -m)" in
        x86_64)  ARCH="amd64" ;;
        aarch64) ARCH="arm64" ;;
        arm64)   ARCH="arm64" ;;
        *)       ARCH="amd64" ;;
    esac
fi

case "${ARCH}" in
    amd64) PLATFORM="linux/amd64" ;;
    arm64) PLATFORM="linux/arm64" ;;
    *)     echo "Error: Unsupported ARCH '${ARCH}'. Use 'amd64' or 'arm64'."; exit 1 ;;
esac

TMPDIR="${SCRIPT_DIR}/.deploy-tmp"

# ---------------------------------------------------------------------------
echo ""
echo "[1/4] Building web UI..."
cd "${PROJECT_DIR}/web" && npm ci && npm run build
echo "  Web UI built"

# ---------------------------------------------------------------------------
echo ""
echo "[2/4] Downloading server binary from GitHub Release..."
DOWNLOAD_DIR=$(mktemp -d)

LATEST_TAG=$(gh release list --repo lsynpy/polaris --limit 1 --json tagName --jq '.[0].tagName' 2>/dev/null)

if [[ -z "${LATEST_TAG}" ]]; then
    echo "  Error: No releases found"
    echo "  Trigger a build first:"
    echo "    gh workflow run 'Build ${ARCH} Binary'"
    rm -rf "${DOWNLOAD_DIR}"
    exit 1
fi

echo "  Latest release: ${LATEST_TAG}"

if ! gh release download "${LATEST_TAG}" \
    --repo lsynpy/polaris \
    --pattern "polaris-${ARCH}.tar.gz" \
    --dir "${DOWNLOAD_DIR}" --clobber 2>/dev/null; then
    echo "  Error: Failed to download polaris-${ARCH}.tar.gz"
    echo "  Trigger a build first:"
    echo "    gh workflow run 'Build ${ARCH^^} Binary'"
    rm -rf "${DOWNLOAD_DIR}"
    exit 1
fi

mkdir -p "${TMPDIR}/server"
tar xzf "${DOWNLOAD_DIR}/polaris-${ARCH}.tar.gz" -C "${TMPDIR}/server"
chmod +x "${TMPDIR}/server/polaris"
rm -rf "${DOWNLOAD_DIR}"
echo "  Binary downloaded"

# ---------------------------------------------------------------------------
echo ""
echo "[3/4] Building Docker image (${PLATFORM})..."

mkdir -p "${TMPDIR}/web"
cp -r "${PROJECT_DIR}/web/dist/"* "${TMPDIR}/web/"

cat > "${TMPDIR}/Dockerfile" << 'DOCKERFILE'
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /usr/share/polaris/web /var/cache/polaris /var/lib/polaris

COPY server/polaris /usr/local/bin/polaris
COPY web /usr/share/polaris/web

WORKDIR /var/lib/polaris

EXPOSE 5050

ENTRYPOINT ["polaris"]
CMD ["-f"]
DOCKERFILE

DOCKER_BUILDKIT=1 docker buildx build \
    --platform "${PLATFORM}" \
    --load -t "polaris:staging" \
    "${TMPDIR}"

echo "  Image built: polaris:staging"

# ---------------------------------------------------------------------------
echo ""
echo "[4/4] Tagging and pushing to Aliyun ACR..."

docker login --username "${ALIYUN_NAMESPACE}" "${REGISTRY}" 2>/dev/null || \
    { echo "  Login with cached credentials..."; docker login "${REGISTRY}"; }

docker tag "polaris:staging" "${IMAGE_TAG}"
docker push "${IMAGE_TAG}"

rm -rf "${TMPDIR}"

echo ""
echo "==> Image ready: ${IMAGE_TAG}"
echo "  To deploy: make deploy ENV=local|jdc IMAGE_TAG=${IMAGE_TAG}"
