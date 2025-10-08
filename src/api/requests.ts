import "../config/env.js";
import { api } from "./axios.js";
import type { CreateAppRequest, CreateAppResponse } from "./types.js";

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
};
