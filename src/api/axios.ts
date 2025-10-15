import "../config/env.js";
import axios, { AxiosInstance, AxiosRequestConfig } from "axios";
import { getApiToken } from "./config.js";
import packageJson from "../../package.json" with { type: "json" };

const BASE_URL =
  process.env.FIREBERRY_API_URL || "https://app.fireberry.com/api/v3";

const fbApi: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
    "User-Agent": `@fireberry/cli@${packageJson.version}`,
  },
});

fbApi.interceptors.request.use(
  async (config) => {
    try {
      const token = await getApiToken();
      if (token) {
        config.headers.tokenid = token;
      }
    } catch (error) {
      console.warn("Failed to get API token:", error);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export async function sendApiRequest<T = any>(
  config: AxiosRequestConfig
): Promise<T> {
  try {
    const response = await fbApi.request<T>(config);

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const message = error.response?.data?.message || error.message;
      const status = error.response?.status;
      throw new Error(`API Error${status ? ` (${status})` : ""}: ${message}`);
    }
    throw error;
  }
}

export const api = {
  get: <T = any>(url: string, config?: AxiosRequestConfig) =>
    sendApiRequest<T>({ ...config, method: "GET", url }),

  post: <T = any>(url: string, data?: any, config?: AxiosRequestConfig) =>
    sendApiRequest<T>({ ...config, method: "POST", url, data }),

  put: <T = any>(url: string, data?: any, config?: AxiosRequestConfig) =>
    sendApiRequest<T>({ ...config, method: "PUT", url, data }),

  patch: <T = any>(url: string, data?: any, config?: AxiosRequestConfig) =>
    sendApiRequest<T>({ ...config, method: "PATCH", url, data }),

  delete: <T = any>(url: string, data?: any, config?: AxiosRequestConfig) =>
    sendApiRequest<T>({ ...config, method: "DELETE", url, data }),
};

export default fbApi;
