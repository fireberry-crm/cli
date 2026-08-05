import "../config/env.js";
import { BASE_SERVICE_URL } from "../constants/component-types.js";
import { api } from "./axios.js";
import type { Manifest, ZippedComponent } from "./types.js";

// Note: api.* throws a typed ApiError (see ./errors.ts) on transport/HTTP
// failures. We deliberately let it propagate unchanged so callers (CLI and MCP)
// can read its `code`/`fatal` fields instead of a flattened generic Error.

export const createApp = async (manifest: Manifest): Promise<void> => {
  const url = `${BASE_SERVICE_URL}/create`;
  await api.post<void>(url, { manifest });
};

export const pushComponents = async (
  components: ZippedComponent[],
  manifest: Manifest,
  icon?: Buffer
): Promise<void> => {
  const url = `${BASE_SERVICE_URL}/push`;
  await api.post<void>(url, { components, manifest, icon });
};

export const installApp = async (manifest: Manifest): Promise<void> => {
  const url = `${BASE_SERVICE_URL}/install`;
  await api.post<void>(url, { manifest }, { timeout: 300000 }); // 5 minutes
};

export const deleteApp = async (manifest: Manifest): Promise<void> => {
  const url = `${BASE_SERVICE_URL}/delete`;
  await api.delete<void>(url, { manifest });
};

export const deployApp = async (appId: string): Promise<void> => {
  const url = `${BASE_SERVICE_URL}/deploy`;
  await api.post<void>(url, { appId });
};

export const deployMarketplace = async (
  components: ZippedComponent[],
  manifest: Manifest,
  icon?: Buffer
): Promise<void> => {
  const url = `${BASE_SERVICE_URL}/marketplace/deploy`;
  await api.post<void>(url, { components, manifest, icon });
};

export const updateDebug = async (
  componentId: string,
  manifest: Manifest,
  debugUrl?: string
): Promise<void> => {
  const url = `${BASE_SERVICE_URL}/debug`;
  await api.post<void>(url, { componentId, debugUrl, manifest });
};
