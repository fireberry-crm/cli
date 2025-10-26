import "../config/env.js";
import axios, { AxiosInstance, AxiosRequestConfig } from "axios";
import { getApiToken } from "./config.js";
import packageJson from "../../package.json" with { type: "json" };

const getDefaultApiUrl = () => {
  if (process.env.FIREBERRY_API_URL) {
    return process.env.FIREBERRY_API_URL;
  }
  
  const isBeta = packageJson.version.includes("beta");
  
  if (isBeta) {
    return process.env.FIREBERRY_STAGING_URL || "https://dev.fireberry.com/api/v3";
  }
  
  return "https://api.fireberry.com/api/v3";
};

const BASE_URL = getDefaultApiUrl();

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
        config.headers.tokenId = token;
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
      const status = error.response?.status;
      let errorMessage:string;

      switch (status) {
        case 401:
          errorMessage = "Unauthorized user.";
          break;
        case 500:
          errorMessage = "Internal server error.";
          break;
        default:
          errorMessage = error.response?.data?.message || error.message;
      }

      throw new Error(`Error: ${errorMessage}`);
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
