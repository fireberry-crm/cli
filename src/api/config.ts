import { getActiveToken } from "../profiles/store.js";

export async function getApiToken(): Promise<string | null> {
  try {
    return await getActiveToken();
  } catch (error) {
    console.warn("Failed to read config file:", error);
    return null;
  }
}
