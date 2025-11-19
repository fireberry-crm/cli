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
  components: ZippedComponent[]
): Promise<void> => {
  const url = `/services/developer/push`;
  try {
    await api.post<void>(url, { appId, components });
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : "Unknown error");
  }
};

export const installApp = async (manifest: Manifest): Promise<void> => {
  const url = `/services/developer/install`;
  try {
    await api.post<void>(url, { manifest });
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : "Unknown error");
  }
};
