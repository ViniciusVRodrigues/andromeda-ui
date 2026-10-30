#!/usr/bin/env bash
# Blue-green deploy for andromeda-ui.
# Required env vars: IMAGE
# Opcionais: HEALTH_RETRIES (12) e HEALTH_INTERVAL (5, em segundos).
#
# Fluxo: green (3001) prova a imagem -> o blue antigo para e vira "-old" ->
# o blue novo sobe na 3000 e passa pelo mesmo health check -> se falhar,
# o "-old" volta no lugar. Qualquer falha termina com exit 1.
set -euo pipefail

BLUE="andromeda-ui-blue"
OLD="andromeda-ui-blue-old"
GREEN="andromeda-ui-green"
GREEN_PORT=3001
BLUE_PORT=3000
HEALTH_RETRIES="${HEALTH_RETRIES:-12}"
HEALTH_INTERVAL="${HEALTH_INTERVAL:-5}"

log() { echo "[deploy-ui] $*"; }

exists() { docker inspect "$1" >/dev/null 2>&1; }

# wait_healthy <container> <port>: 0 quando o / responde 2xx, 1 depois das tentativas.
wait_healthy() {
  local name="$1" port="$2" i
  local url="http://localhost:${port}/"
  log "Waiting for health check at ${url}"
  for i in $(seq 1 "${HEALTH_RETRIES}"); do
    if curl -sf -o /dev/null "${url}"; then
      log "${name} is healthy"
      return 0
    fi
    if [ "${i}" -eq "${HEALTH_RETRIES}" ]; then
      return 1
    fi
    log "Attempt ${i}/${HEALTH_RETRIES} — retrying in ${HEALTH_INTERVAL}s"
    log "── log do ${name} (últimas 20 linhas) ──"
    docker logs --tail 20 "${name}" 2>&1 || true
    log "────────────────────────────────────────"
    sleep "${HEALTH_INTERVAL}"
  done
  return 1
}

# Sobras de uma execução interrompida
if exists "${BLUE}"; then
  if exists "${OLD}"; then
    log "Removendo ${OLD} deixado por uma execução anterior"
    docker rm -f "${OLD}" >/dev/null
  fi
elif exists "${OLD}"; then
  log "${BLUE} não existe e ${OLD} sim (execução anterior morreu na troca) — restaurando"
  docker rename "${OLD}" "${BLUE}"
  docker start "${BLUE}" >/dev/null
fi

log "Pulling ${IMAGE}"
docker pull "${IMAGE}"

log "Starting green container on port ${GREEN_PORT}"
docker rm -f "${GREEN}" 2>/dev/null || true
docker run -d \
  --name "${GREEN}" \
  --network andromeda-net \
  -p "127.0.0.1:${GREEN_PORT}:80" \
  --restart unless-stopped \
  "${IMAGE}"

if ! wait_healthy "${GREEN}" "${GREEN_PORT}"; then
  log "Health check failed — green não subiu, blue intocado"
  log "── últimas linhas de log do green ──"
  docker logs --tail 50 "${GREEN}" 2>&1 || true
  docker rm -f "${GREEN}"
  exit 1
fi

# Green não atende tráfego: sai antes do blue novo para nunca haver três uis ao mesmo tempo.
docker rm -f "${GREEN}" >/dev/null

HAD_BLUE=false
if exists "${BLUE}"; then
  HAD_BLUE=true
  log "Switching traffic: stopping blue (guardado como ${OLD})"
  docker stop -t 10 "${BLUE}" >/dev/null
  docker rename "${BLUE}" "${OLD}"
else
  log "Primeiro deploy: não há blue anterior"
fi

log "Starting new ${BLUE} on port ${BLUE_PORT}"
if docker run -d \
     --name "${BLUE}" \
     --network andromeda-net \
     -p "127.0.0.1:${BLUE_PORT}:80" \
     --restart unless-stopped \
     "${IMAGE}" \
   && wait_healthy "${BLUE}" "${BLUE_PORT}"; then
  if [ "${HAD_BLUE}" = true ]; then
    docker rm "${OLD}" >/dev/null
  fi
  log "Deploy complete — ${IMAGE} running as ${BLUE} on port ${BLUE_PORT}"
  exit 0
fi

log "Novo ${BLUE} não ficou saudável — rolling back"
log "── últimas linhas de log do ${BLUE} novo ──"
docker logs --tail 50 "${BLUE}" 2>&1 || true
docker rm -f "${BLUE}" >/dev/null 2>&1 || true

if [ "${HAD_BLUE}" != true ]; then
  log "Não havia blue anterior para restaurar"
  exit 1
fi

docker rename "${OLD}" "${BLUE}"
docker start "${BLUE}" >/dev/null
if wait_healthy "${BLUE}" "${BLUE_PORT}"; then
  log "Rollback concluído: blue anterior está UP; o deploy FALHOU"
else
  log "PRODUÇÃO FORA: o blue anterior também não subiu — ação manual"
fi
exit 1
