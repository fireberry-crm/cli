import "../config/env.js";
import axios, { AxiosInstance, AxiosRequestConfig } from "axios";
import { getApiToken } from "./config.js";

const BASE_URL =
  process.env.FIREBERRY_API_URL || "https://app.fireberry.com/api/v3";

const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
    "User-Agent": "@fireberry/cli",
  },
});

apiClient.interceptors.request.use(
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
    const response = await apiClient.request<T>(config);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const message = error.response?.data?.message || error.message;
      const status = error.response?.status;
      const fullUrl = error.config?.url
        ? `${BASE_URL}${error.config.url}`
        : "Unknown URL";
      throw new Error(`API Error (${status}) at ${fullUrl}: ${message}`);
    }

    const fullUrl = config.url ? `${BASE_URL}${config.url}` : "Unknown URL";
    throw new Error(
      `Request failed at ${fullUrl}: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
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

  delete: <T = any>(url: string, config?: AxiosRequestConfig) =>
    sendApiRequest<T>({ ...config, method: "DELETE", url }),
};

export default apiClient;
