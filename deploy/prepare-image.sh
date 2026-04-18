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
echo "[1/4] Checking if image exists in ACR: ${IMAGE_TAG} (${ARCH})..."

if docker manifest inspect "${IMAGE_TAG}" 2>/dev/null | grep -q "\"architecture\": \"${ARCH}\""; then
    echo "  Image for ${ARCH} found — skipping build"
    echo ""
    echo "==> Image ready: ${IMAGE_TAG}"
    exit 0
fi

echo "  Image for ${ARCH} not found — need to build"

# ---------------------------------------------------------------------------
# Helper: download binary from existing release for current ARCH
download_binary_from_release() {
    local tag="$1"
    local download_dir
    download_dir=$(mktemp -d)

    if ! gh release download "${tag}" \
        --repo lsynpy/polaris \
        --pattern "polaris-${ARCH}.tar.gz" \
        --dir "${download_dir}" --clobber 2>/dev/null; then
        rm -rf "${download_dir}"
        return 1
    fi

    mkdir -p "${TMPDIR}/server"
    tar xzf "${download_dir}/polaris-${ARCH}.tar.gz" -C "${TMPDIR}/server"
    chmod +x "${TMPDIR}/server/polaris"
    rm -rf "${download_dir}"
    return 0
}

# ---------------------------------------------------------------------------
FULL_SHA="$(git rev-parse HEAD 2>/dev/null || echo "")"
SHORT_SHA="$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")"

echo ""
echo "[2/4] Checking if release exists for commit ${SHORT_SHA} (${ARCH})..."

RELEASE_TAG=""
# Tag format: latest-{ARCH}-{YYYYMMDD}-{SHA}
release_json=$(gh release list --repo lsynpy/polaris --limit 20 --json tagName 2>/dev/null) || true
if [[ -n "${release_json}" ]]; then
    RELEASE_TAG=$(echo "${release_json}" | python3 -c "
import sys, json
releases = json.load(sys.stdin)
sha = '${FULL_SHA}'
short_sha = '${SHORT_SHA}'
arch = '${ARCH}'
for r in releases:
    tag = r['tagName']
    if f'-{arch}-' in tag and (short_sha in tag or sha in tag):
        print(tag)
        exit()
print('')
" 2>/dev/null) || true
fi

if [[ -n "${RELEASE_TAG}" ]]; then
    echo "  Found existing release: ${RELEASE_TAG}"
    echo "  Downloading server binary..."
    if download_binary_from_release "${RELEASE_TAG}"; then
        echo "  Binary downloaded"
        SKIP_BUILD="true"
    else
        echo "  Failed to download from release, will trigger new build"
        SKIP_BUILD="false"
    fi
else
    echo "  No existing release for this commit"
    SKIP_BUILD="false"
fi

# ---------------------------------------------------------------------------
if [[ "${SKIP_BUILD}" == "false" ]]; then
    echo ""
    echo "[3/4] Triggering GitHub Actions build (both archs)..."
    OUTPUT=$(gh workflow run "Build All Binaries" --ref master 2>&1) || true
    RUN_ID="${OUTPUT##*/}"
    RUN_ID="${RUN_ID//[^0-9]/}"
    if [[ -z "${RUN_ID}" ]]; then
        echo "  Error: Failed to trigger workflow"
        echo "  ${OUTPUT}"
        exit 1
    fi
    echo "  Run: https://github.com/lsynpy/polaris/actions/runs/${RUN_ID}"
    echo "  Waiting for both arch builds to complete..."

    # Poll every 5s until completed
    max_attempts=120  # 10 minutes max
    attempt=0
    while true; do
        attempt=$((attempt + 1))
        if [[ ${attempt} -gt ${max_attempts} ]]; then
            echo "  Timeout waiting for build"
            exit 1
        fi
        run_json=$(gh run view "${RUN_ID}" --json status,conclusion 2>/dev/null) || true
        if [[ -z "${run_json}" ]]; then
            echo "  $(date +%H:%M:%S) waiting for run to appear..."
            sleep 5
            continue
        fi
        status=$(echo "${run_json}" | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])" 2>/dev/null) || status="unknown"
        conclusion=$(echo "${run_json}" | python3 -c "import sys,json; print(json.load(sys.stdin)['conclusion'])" 2>/dev/null) || conclusion="..."
        echo "  $(date +%H:%M:%S) status=${status} conclusion=${conclusion}"
        if [[ "${status}" == "completed" ]]; then
            break
        fi
        sleep 5
    done

    if [[ "${conclusion}" != "success" ]]; then
        echo "  Build failed (conclusion: ${conclusion})"
        echo "  Check: https://github.com/lsynpy/polaris/actions/runs/${RUN_ID}"
        exit 1
    fi
    echo "  Build succeeded"

    echo "  Finding latest release for ${ARCH}..."
    LATEST_TAG=$(gh release list --repo lsynpy/polaris --limit 5 --json tagName 2>/dev/null | python3 -c "import sys,json; [print(r['tagName']) for r in json.load(sys.stdin)]" 2>/dev/null | grep "${ARCH}" | head -1)

    if [[ -z "${LATEST_TAG}" ]]; then
        echo "  Error: No release found for ${ARCH}"
        exit 1
    fi
    echo "  Release: ${LATEST_TAG}"

    echo "  Downloading server binary..."
    download_binary_from_release "${LATEST_TAG}" || {
        echo "  Error: Failed to download polaris-${ARCH}.tar.gz"
        exit 1
    }
    echo "  Binary downloaded"
fi

# ---------------------------------------------------------------------------
echo ""
echo "[4/4] Building web UI and Docker image..."

cd "${PROJECT_DIR}/web" && npm ci && npm run build
echo "  Web UI built"

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
echo "  Tagging and pushing to Aliyun ACR..."

docker tag "polaris:staging" "${IMAGE_TAG}"
docker push "${IMAGE_TAG}"

rm -rf "${TMPDIR}"

echo ""
echo "==> Image built and pushed: ${IMAGE_TAG}"
