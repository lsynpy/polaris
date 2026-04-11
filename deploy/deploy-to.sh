#!/usr/bin/env bash
set -euo pipefail

# Usage: deploy-to.sh [local|jdc]
ENV="${1:?Usage: deploy-to.sh [local|jdc]}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

ENV_FILE="${SCRIPT_DIR}/.env.${ENV}"
REGISTRY_FILE="${SCRIPT_DIR}/.registry.env"

if [[ ! -f "${ENV_FILE}" ]]; then
    echo "Error: ${ENV_FILE} not found"
    exit 1
fi

if [[ ! -f "${REGISTRY_FILE}" ]]; then
    echo "Error: ${REGISTRY_FILE} not found"
    exit 1
fi

# shellcheck source=/dev/null
source "${REGISTRY_FILE}"
# shellcheck source=/dev/null
source "${ENV_FILE}"

REGISTRY="registry.${REGION}.aliyuncs.com"
IMAGE="${REGISTRY}/${ALIYUN_NAMESPACE}/polaris:latest"
IMAGE_DEV="${REGISTRY}/${ALIYUN_NAMESPACE}/polaris:dev"
BUILD_PLATFORM="${BUILD_PLATFORM:-linux/arm64,linux/amd64}"
if [[ "${IS_LOCAL}" == "true" ]]; then
    IMAGE_TAG="polaris:${ENV}"
else
    IMAGE_TAG="${IMAGE}"
fi

echo "==> Deploying Polaris [${ENV}]..."
echo "  Target: $([[ "${IS_LOCAL}" == "true" ]] && echo "Local Docker" || echo "VPS: ${VPS_HOSTNAME}")"
echo "  Image:  ${IMAGE}"

# ---------------------------------------------------------------------------
# Build and push to Aliyun ACR
build_and_push() {
    echo ""
    echo "[1/3] Building image locally (${BUILD_PLATFORM})..."
    echo "  Note: First build takes 10-15 minutes, subsequent builds are faster"
    echo "        (Docker cache preserves Rust compilation artifacts)"
    echo ""
    
    # Ensure BuildKit is enabled (required for cache mounts)
    export DOCKER_BUILDKIT=1
    
    # Start build in background and show progress
    docker buildx build \
        --platform "${BUILD_PLATFORM}" \
        --load \
        --progress=plain \
        -f "${PROJECT_DIR}/Dockerfile" \
        -t "polaris:push-staging" \
        "${PROJECT_DIR}" 2>&1 | tee /tmp/polaris-build.log &
    BUILD_PID=$!
    
    # Monitor progress
    while kill -0 $BUILD_PID 2>/dev/null; do
        sleep 30
        if [[ -f /tmp/polaris-build.log ]]; then
            LAST_LINE=$(tail -1 /tmp/polaris-build.log 2>/dev/null | head -100)
            LINES=$(wc -l < /tmp/polaris-build.log 2>/dev/null || echo "?")
            echo "  [Still building... ${LINES} lines] ${LAST_LINE:0:100}"
        fi
    done
    
    # Check if build succeeded
    if ! wait $BUILD_PID; then
        echo "Error: Build failed! Check /tmp/polaris-build.log for details"
        exit 1
    fi
    
    echo ""
    echo "[2/3] Pushing to registry..."
    docker tag "polaris:push-staging" "${IMAGE}"
    docker push "${IMAGE}"
    docker tag "polaris:push-staging" "${IMAGE_DEV}"
    docker push "${IMAGE_DEV}"

    echo "[3/3] Verifying..."
    sleep 2
    echo "  Pushed to ${REGISTRY}/${ALIYUN_NAMESPACE}"
}

# ---------------------------------------------------------------------------
# Local deployment (builds locally, no push)
deploy_local() {
    echo ""
    echo "[1/3] Building image: polaris:${ENV}"
    echo "  Note: First build takes 10-15 minutes, subsequent builds are faster"
    echo ""
    
    # Ensure BuildKit is enabled
    export DOCKER_BUILDKIT=1
    
    cd "${PROJECT_DIR}"
    docker build --progress=plain -t "polaris:${ENV}" . 2>&1 | tee /tmp/polaris-build.log &
    BUILD_PID=$!
    
    while kill -0 $BUILD_PID 2>/dev/null; do
        sleep 30
        if [[ -f /tmp/polaris-build.log ]]; then
            LAST_LINE=$(tail -1 /tmp/polaris-build.log 2>/dev/null | head -100)
            echo "  [Still building...] ${LAST_LINE:0:100}"
        fi
    done
    
    if ! wait $BUILD_PID; then
        echo "Error: Build failed! Check /tmp/polaris-build.log"
        exit 1
    fi

    echo "[2/3] Stopping existing container..."
    docker stop polaris 2>/dev/null || true
    docker rm polaris 2>/dev/null || true

    # Ensure host directories exist
    mkdir -p "${CONFIG_DIR}"

    # Write pre-configured polaris.toml
    CONFIG_FILE="${CONFIG_DIR}/polaris.toml"
    if [[ ! -f "${CONFIG_FILE}" ]]; then
        echo "  Writing config to ${CONFIG_FILE}..."
        mkdir -p "${CONFIG_DIR}"
        cat > "${CONFIG_FILE}" << EOF
album_art_pattern = "(album|cover|folder|front|back|artwork)[.](jpeg|jpg|png)"

[[mount_dirs]]
source = "${MUSIC_DIR}"
name = "Music"

[users]

[users.admin]
admin = true
initial_password = "admin"
EOF
    else
        echo "  Config exists at ${CONFIG_FILE}, preserving..."
        if ! grep -q '^\[\[mount_dirs\]\]' "${CONFIG_FILE}" 2>/dev/null; then
            echo "  Adding mount_dirs to existing config..."
            cat >> "${CONFIG_FILE}" << EOF

[[mount_dirs]]
source = "${MUSIC_DIR}"
name = "Music"
EOF
        fi
    fi

    mkdir -p "${CACHE_DIR}"

    echo "[3/3] Starting container on port ${POLARIS_PORT}..."
    docker run -d \
        --name polaris \
        --restart unless-stopped \
        -p "${POLARIS_PORT}:${POLARIS_PORT}" \
        -v "${MUSIC_DIR}:/music" \
        -v "${CONFIG_DIR}:/var/lib/polaris" \
        -v "${CACHE_DIR}:/var/cache/polaris" \
        "polaris:${ENV}" \
        -f \
        -w /usr/share/polaris/web

    echo ""
    echo "==> Deployed!"
    echo "  Web UI:   http://localhost:${POLARIS_PORT}"
    echo "  API docs: http://localhost:${POLARIS_PORT}/api-docs/"
    echo ""
    docker ps --filter "name=polaris" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
}

# ---------------------------------------------------------------------------
# Remote deployment (build, push, SSH deploy)
deploy_remote() {
    if [[ -z "${VPS_HOSTNAME}" ]]; then
        echo "Error: VPS_HOSTNAME not set in ${ENV_FILE}"
        exit 1
    fi

    # Build and push to Aliyun ACR
    build_and_push

    # Prepare dirs on VPS
    echo ""
    echo "==> Preparing dirs on ${VPS_HOSTNAME}..."
    ssh "${VPS_HOSTNAME}" "mkdir -p ${CONFIG_DIR} ${CACHE_DIR}"

    # Write config on VPS
    echo "==> Writing config on ${VPS_HOSTNAME}..."
    ssh "${VPS_HOSTNAME}" << REMOTE_EOF
        set -euo pipefail

        CONFIG_FILE="${CONFIG_DIR}/polaris.toml"

        if [[ -f "\${CONFIG_FILE}" ]]; then
            echo "  Config exists, preserving..."
            if ! grep -q '^\[\[mount_dirs\]\]' "\${CONFIG_FILE}" 2>/dev/null; then
                echo "  Adding mount_dirs..."
                cat >> "\${CONFIG_FILE}" << EOF2

[[mount_dirs]]
source = "${MUSIC_DIR}"
name = "Music"
EOF2
            fi
        else
            echo "  Writing new config..."
            cat > "\${CONFIG_FILE}" << EOF2
album_art_pattern = "(album|cover|folder|front|back|artwork)[.](jpeg|jpg|png)"

[[mount_dirs]]
source = "${MUSIC_DIR}"
name = "Music"

[users]

[users.admin]
admin = true
initial_password = "admin"
EOF2
        fi
REMOTE_EOF

    # Deploy on VPS
    echo "==> Deploying on ${VPS_HOSTNAME}..."
    ssh "${VPS_HOSTNAME}" << REMOTE_EOF
        set -euo pipefail

        echo "  Stopping existing container..."
        docker stop polaris 2>/dev/null || true
        docker rm polaris 2>/dev/null || true

        echo "  Pulling image..."
        docker pull ${IMAGE}

        echo "  Starting container..."
        docker run -d \
            --name polaris \
            --restart unless-stopped \
            -p ${POLARIS_PORT}:${POLARIS_PORT} \
            -v ${MUSIC_DIR}:/music \
            -v ${CONFIG_DIR}:/var/lib/polaris \
            -v ${CACHE_DIR}:/var/cache/polaris \
            ${IMAGE} \
            -f \
            -w /usr/share/polaris/web

        echo "  Done."
        docker ps --filter "name=polaris" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
REMOTE_EOF

    echo ""
    echo "==> Deployed on ${VPS_HOSTNAME}!"
}

# ---------------------------------------------------------------------------
if [[ "${IS_LOCAL}" == "true" ]]; then
    deploy_local
else
    deploy_remote
fi
