import ora from "ora";
import { installApp } from "../api/requests.js";
import {
  getManifest,
  validateManifestComponents,
} from "../utils/components.utils.js";

export async function runInstall(): Promise<void> {
  const spinner = ora("Loading manifest...").start();

  try {
    const manifest = await getManifest();

    await validateManifestComponents(manifest);

    spinner.start("Installing app on Fireberry...");
    await installApp(manifest);
    spinner.succeed("App installed successfully");
  } catch (error) {
    spinner.fail("Installation failed");
    throw error;
  }
}
