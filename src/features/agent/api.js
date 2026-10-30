/* API da feature agent — agente local de uso de IA (agente-telas, D1). */

import { api } from "../../core/api/client.js";

const code = (c) => encodeURIComponent(c);

export function getAgentMeta() {
  return api.get("/v1/agent/meta");
}

export function getAgentDevices() {
  return api.get("/v1/agent/devices");
}

/** 404 AGENT_DEVICE_NOT_FOUND = já revogado: conta como sucesso. */
export async function revokeAgentDevice(id) {
  try {
    await api.delete(`/v1/agent/devices/${encodeURIComponent(id)}`);
  } catch (e) {
    if (e?.status === 404) return null;
    throw e;
  }
  return null;
}

/** 202 {deviceId, syncRequestedAt, syncServedAt}. 404 AGENT_DEVICE_NOT_FOUND o hook trata. */
export function requestAgentSync(deviceId) {
  return api.post(`/v1/agent/devices/${encodeURIComponent(deviceId)}/sync`);
}

export function getAgentToday() {
  return api.get("/v1/agent/today");
}

/** @param {string} userCode "XXXX-XXXX" */
export function getPairing(userCode) {
  return api.get(`/v1/agent/pairing/${code(userCode)}`);
}

export function approvePairing(userCode) {
  return api.post(`/v1/agent/pairing/${code(userCode)}/approve`);
}

export function denyPairing(userCode) {
  return api.post(`/v1/agent/pairing/${code(userCode)}/deny`);
}
