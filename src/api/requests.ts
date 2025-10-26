import "../config/env.js";
import { api } from "./axios.js";
import type {
  CreateAppRequest,
  CreateAppResponse,
  ZippedComponent,
} from "./types.js";

export const requests = {
  createApp: async (data: CreateAppRequest): Promise<CreateAppResponse> => {
    const url = "/services/developer/create";
    try {
      const response = await api.post<CreateAppResponse>(url, data);
      return response;
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : "Unknown error");
    }
  },

  pushComponents: async (
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
  },
};
