import "../config/env.js";
import { BASE_SERVICE_URL } from "../constants/component-types.js";
import { api } from "./axios.js";
import type {
  Manifest,
  ZippedComponent,
  ZippedComponentPayload,
} from "./types.js";

const UPLOAD_CONFIG = {
  timeout: 300000, // 5 minutes
};

// leave some room for the manifest and the surrounding JSON
const MAX_UPLOAD_BYTES = 14 * 1024 * 1024;

const toMB = (bytes: number) => (bytes / 1024 / 1024).toFixed(2);

const buildUploadPayload = (
  components: ZippedComponent[],
  icon?: Buffer
): { components: ZippedComponentPayload[]; icon?: string } => {
  const totalBytes =
    components.reduce((sum, comp) => sum + comp.build.length, 0) +
    (icon?.length ?? 0);

  if (totalBytes > MAX_UPLOAD_BYTES) {
    throw new Error(
      `Upload is too large: ${toMB(totalBytes)} MB exceeds the ${toMB(
        MAX_UPLOAD_BYTES
      )} MB limit.\nReduce your component build sizes and try again.`
    );
  }

  return {
    components: components.map((comp) => ({
      title: comp.title,
      id: comp.id,
      build: comp.build.toString("base64"),
    })),
    icon: icon?.toString("base64"),
  };
};

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
  const payload = buildUploadPayload(components, icon);
  await api.post<void>(url, { ...payload, manifest }, UPLOAD_CONFIG);
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
  const payload = buildUploadPayload(components, icon);
  await api.post<void>(url, { ...payload, manifest }, UPLOAD_CONFIG);
};

export const updateDebug = async (
  componentId: string,
  manifest: Manifest,
  debugUrl?: string
): Promise<void> => {
  const url = `${BASE_SERVICE_URL}/debug`;
  await api.post<void>(url, { componentId, debugUrl, manifest });
};
