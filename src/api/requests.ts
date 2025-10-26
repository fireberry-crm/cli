import "../config/env.js";
import { api } from "./axios.js";
import type { CreateAppRequest, ZippedComponent } from "./types.js";

export const createApp = async (data: CreateAppRequest): Promise<void> => {
  const url = "/services/developer/create";
  try {
    const response = await api.post<void>(url, data);
    return response;
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
    const response = await api.post<void>(url, { appId, components });
    return response;
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : "Unknown error");
  }
};
