#!/usr/bin/env bash
# Blue-green deploy for andromeda-ui.
# Required env vars: IMAGE
set -euo pipefail

BLUE="andromeda-ui-blue"
GREEN="andromeda-ui-green"
GREEN_PORT=3001
BLUE_PORT=3000
HEALTH_URL="http://localhost:${GREEN_PORT}"
HEALTH_RETRIES=12
HEALTH_INTERVAL=5

echo "[deploy-ui] Pulling ${IMAGE}"
docker pull "${IMAGE}"

echo "[deploy-ui] Starting green container on port ${GREEN_PORT}"
docker rm -f "${GREEN}" 2>/dev/null || true
docker run -d \
  --name "${GREEN}" \
  -p "127.0.0.1:${GREEN_PORT}:80" \
  --restart unless-stopped \
  "${IMAGE}"

echo "[deploy-ui] Waiting for health check at ${HEALTH_URL}"
for i in $(seq 1 ${HEALTH_RETRIES}); do
  if curl -sf -o /dev/null "${HEALTH_URL}"; then
    echo "[deploy-ui] Green is healthy"
    break
  fi
  if [ "${i}" -eq "${HEALTH_RETRIES}" ]; then
    echo "[deploy-ui] Health check failed — rolling back"
    docker rm -f "${GREEN}"
    exit 1
  fi
  echo "[deploy-ui] Attempt ${i}/${HEALTH_RETRIES} — retrying in ${HEALTH_INTERVAL}s"
  sleep "${HEALTH_INTERVAL}"
done

echo "[deploy-ui] Switching traffic: stopping blue, promoting green"
docker rm -f "${BLUE}" 2>/dev/null || true
docker stop "${GREEN}"
docker rm "${GREEN}"

docker run -d \
  --name "${BLUE}" \
  -p "127.0.0.1:${BLUE_PORT}:80" \
  --restart unless-stopped \
  "${IMAGE}"

echo "[deploy-ui] Deploy complete — ${IMAGE} running as ${BLUE} on port ${BLUE_PORT}"
