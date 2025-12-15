import "../config/env.js";
import { api } from "./axios.js";
import type { CreateAppRequest, Manifest, ZippedComponent } from "./types.js";

export const createApp = async (data: CreateAppRequest): Promise<void> => {
  const url = "/services/developer/create";
  try {
    await api.post<void>(url, data);
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : "Unknown error");
  }
};

export const pushComponents = async (
  appId: string,
  components: ZippedComponent[],
  manifest: Manifest
): Promise<void> => {
  const url = `/services/developer/push`;
  try {
    await api.post<void>(url, { appId, components, manifest });
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : "Unknown error");
  }
};

export const installApp = async (manifest: Manifest): Promise<void> => {
  const url = `/services/developer/install`;
  try {
    await api.post<void>(url, { manifest }, { timeout: 300000 }); // 5 minutes
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : "Unknown error");
  }
};

export const deleteApp = async (manifest: Manifest): Promise<void> => {
  const url = `/services/developer/delete`;
  try {
    await api.delete<void>(url, { manifest });
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : "Unknown error");
  }
};
