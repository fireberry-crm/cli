import { installApp } from "../api/requests.js";
import {
  getManifest,
  validateManifestComponents,
} from "../utils/components.utils.js";

export async function runInstall(): Promise<void> {
  try {
    const manifest = await getManifest();
    await validateManifestComponents(manifest);
    await installApp(manifest);
    console.log("App installed successfully");
  } catch (error) {
    throw error;
  }
}
