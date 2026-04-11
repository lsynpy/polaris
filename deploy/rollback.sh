#!/usr/bin/env bash
set -euo pipefail

# Usage: rollback.sh <version> [local|<target>]
VERSION="${1:?Usage: rollback.sh <version> [local|<target>]}"
ENV="${2:-local}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=/dev/null
source "${SCRIPT_DIR}/.env.${ENV}"

IMAGE_NAME="polaris"
CONTAINER_NAME="polaris"
IMAGE_TAG="${IMAGE_NAME}:${VERSION}"

rollback_local() {
    echo "==> Rolling back to ${IMAGE_TAG} [local]..."
    echo "  Run: cd /path/to/polaris && git checkout ${VERSION} && deploy/deploy-to.sh local"
}

rollback_remote() {
    if [[ -z "${VPS_HOSTNAME}" ]]; then
        echo "Error: VPS_HOSTNAME not set"
        exit 1
    fi

    echo "==> Rolling back to ${IMAGE_TAG} on ${VPS_HOSTNAME}..."
    ssh "${VPS_HOSTNAME}" << REMOTE_EOF
        set -euo pipefail

        echo "  Stopping existing container..."
        docker stop ${CONTAINER_NAME} 2>/dev/null || true
        docker rm ${CONTAINER_NAME} 2>/dev/null || true

        echo "  Starting container with tag ${IMAGE_TAG}..."
        docker run -d \
            --name ${CONTAINER_NAME} \
            --restart unless-stopped \
            -p ${POLARIS_PORT}:${POLARIS_PORT} \
            -v ${MUSIC_DIR}:/music \
            -v ${CONFIG_DIR}:/var/lib/polaris \
            -v ${CACHE_DIR}:/var/cache/polaris \
            ${IMAGE_TAG} \
            -f \
            -w /usr/share/polaris/web

        docker ps --filter "name=${CONTAINER_NAME}"
REMOTE_EOF

    echo "==> Rolled back on ${VPS_HOSTNAME}!"
}

if [[ "${IS_LOCAL}" == "true" ]]; then
    rollback_local
else
    rollback_remote
fi
