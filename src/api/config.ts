import envPaths from "env-paths";
import path from "node:path";
import fs from "fs-extra";
import { Config } from "../commands/init.js";

export async function getApiToken(): Promise<string | null> {
  try {
    const paths = envPaths("Fireberry CLI", { suffix: "" });
    const configFile = path.join(paths.config, "config.json");

    if (!(await fs.pathExists(configFile))) {
      return null;
    }

    const config: Config = await fs.readJson(configFile);
    return config.apiToken || null;
  } catch (error) {
    console.warn("Failed to read config file:", error);
    return null;
  }
}
