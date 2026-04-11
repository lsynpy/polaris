#!/usr/bin/env bash
set -euo pipefail

# Usage: deploy-to.sh [local|jdc]
ENV="${1:?Usage: deploy-to.sh [local|jdc]}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

ENV_FILE="${SCRIPT_DIR}/.env.${ENV}"

if [[ ! -f "${ENV_FILE}" ]]; then
    echo "Error: ${ENV_FILE} not found"
    exit 1
fi

# shellcheck source=/dev/null
source "${ENV_FILE}"

echo "==> Deploying Polaris [${ENV}]..."
echo "  Target: $([[ "${IS_LOCAL}" == "true" ]] && echo "Local Docker" || echo "VPS: ${VPS_HOSTNAME}")"
echo "  Platform: ${BUILD_PLATFORM:-linux/arm64}"

# ---------------------------------------------------------------------------
# Download pre-built ARM64 binary from GitHub Release
download_binary() {
    local tmpdir
    tmpdir=$(mktemp -d)
    
    echo ""
    echo "[1/4] Downloading ARM64 binary from GitHub Release..."
    
    # Get latest release asset
    gh release download --repo lsynpy/polaris --pattern 'polaris-arm64.tar.gz' --dir "${tmpdir}" --latest 2>/dev/null
    
    if [[ ! -f "${tmpdir}/polaris-arm64.tar.gz" ]]; then
        echo "Error: Failed to download latest release binary"
        echo "  Make sure a workflow run has completed successfully"
        echo "  See: https://github.com/lsynpy/polaris/releases"
        rm -rf "${tmpdir}"
        exit 1
    fi
    
    # Extract binary
    mkdir -p "${PROJECT_DIR}/.deploy-tmp"
    tar xzf "${tmpdir}/polaris-arm64.tar.gz" -C "${PROJECT_DIR}/.deploy-tmp"
    chmod +x "${PROJECT_DIR}/.deploy-tmp/polaris"
    
    rm -rf "${tmpdir}"
    echo "  Binary downloaded successfully"
}

# ---------------------------------------------------------------------------
# Build minimal Docker image (no Rust toolchain needed)
build_image() {
    local image_name="$1"
    
    echo ""
    echo "[2/4] Building minimal Docker image..."
    
    # Download web UI
    mkdir -p "${PROJECT_DIR}/.deploy-tmp/web"
    wget -qO /tmp/web.zip https://github.com/agersant/polaris-web/releases/latest/download/web.zip
    (cd "${PROJECT_DIR}/.deploy-tmp/web" && unzip -q /tmp/web.zip)
    rm -f /tmp/web.zip
    
    # Create minimal Dockerfile
    cat > "${PROJECT_DIR}/.deploy-tmp/Dockerfile" << 'DOCKERFILE'
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /usr/share/polaris/web /var/cache/polaris /var/lib/polaris

COPY polaris /usr/local/bin/polaris
COPY web /usr/share/polaris/web

WORKDIR /var/lib/polaris

EXPOSE 5050

ENTRYPOINT ["polaris"]
CMD ["-f"]
DOCKERFILE
    
    docker build -t "${image_name}" "${PROJECT_DIR}/.deploy-tmp"
    
    echo "  Image built: ${image_name}"
}

# ---------------------------------------------------------------------------
# Clean up
cleanup() {
    rm -rf "${PROJECT_DIR}/.deploy-tmp"
}

# ---------------------------------------------------------------------------
# Local deployment
deploy_local() {
    local image_name="polaris:${ENV}"
    
    download_binary
    build_image "${image_name}"
    cleanup
    
    echo ""
    echo "[3/4] Stopping existing container..."
    docker stop polaris 2>/dev/null || true
    docker rm polaris 2>/dev/null || true

    # Ensure host directories exist
    mkdir -p "${CONFIG_DIR}" "${CACHE_DIR}"

    # Write config
    CONFIG_FILE="${CONFIG_DIR}/polaris.toml"
    if [[ ! -f "${CONFIG_FILE}" ]]; then
        echo "  Writing config..."
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
        echo "  Config exists, preserving..."
        if ! grep -q '^\[\[mount_dirs\]\]' "${CONFIG_FILE}" 2>/dev/null; then
            echo "  Adding mount_dirs..."
            cat >> "${CONFIG_FILE}" << EOF

[[mount_dirs]]
source = "${MUSIC_DIR}"
name = "Music"
EOF
        fi
    fi

    echo ""
    echo "[4/4] Starting container on port ${POLARIS_PORT}..."
    docker run -d \
        --name polaris \
        --restart unless-stopped \
        -p "${POLARIS_PORT}:${POLARIS_PORT}" \
        -v "${MUSIC_DIR}:/music" \
        -v "${CONFIG_DIR}:/var/lib/polaris" \
        -v "${CACHE_DIR}:/var/cache/polaris" \
        "${image_name}" \
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
# Remote deployment (download binary, build image locally, transfer to JDC via SSH)
deploy_remote() {
    if [[ -z "${VPS_HOSTNAME}" ]]; then
        echo "Error: VPS_HOSTNAME not set in ${ENV_FILE}"
        exit 1
    fi
    
    local image_name="polaris:jdc"
    
    download_binary
    build_image "${image_name}"
    cleanup
    
    # Save image to tar and transfer to VPS
    echo ""
    echo "[3/4] Transferring image to ${VPS_HOSTNAME}..."
    docker save "${image_name}" | ssh "${VPS_HOSTNAME}" "docker load"

    # Prepare dirs on VPS
    echo ""
    echo "[4/4] Deploying on ${VPS_HOSTNAME}..."
    ssh "${VPS_HOSTNAME}" "mkdir -p ${CONFIG_DIR} ${CACHE_DIR}"

    # Write config on VPS
    echo "  Writing config..."
    ssh "${VPS_HOSTNAME}" << REMOTE_EOF
        set -euo pipefail
        CONFIG_FILE="${CONFIG_DIR}/polaris.toml"
        if [[ ! -f "\${CONFIG_FILE}" ]]; then
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
    ssh "${VPS_HOSTNAME}" << REMOTE_EOF
        set -euo pipefail
        echo "  Stopping existing container..."
        docker stop polaris 2>/dev/null || true
        docker rm polaris 2>/dev/null || true
        echo "  Starting container..."
        docker run -d \
            --name polaris \
            --restart unless-stopped \
            -p ${POLARIS_PORT}:${POLARIS_PORT} \
            -v ${MUSIC_DIR}:/music \
            -v ${CONFIG_DIR}:/var/lib/polaris \
            -v ${CACHE_DIR}:/var/cache/polaris \
            ${image_name} \
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
