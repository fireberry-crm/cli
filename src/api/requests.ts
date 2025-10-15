import "../config/env.js";
import { api } from "./axios.js";
import type { CreateAppRequest } from "./types.js";

export const createApp = async (data: CreateAppRequest): Promise<void> => {
  const url = "/services/developer/create";
  try {
    await api.post(url, data);
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : "Unknown error");
  }
};
