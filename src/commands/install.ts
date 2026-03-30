import ora from "ora";
import { installApp } from "../api/requests.js";
import { getManifest } from "../utils/components.utils.js";

export async function runInstall(): Promise<void> {
  const spinner = ora("Loading manifest...").start();

  try {
    const manifest = await getManifest();
    const appId = manifest.app.id;

    spinner.start("Installing app on Fireberry...");
    await installApp(appId);
    spinner.succeed("App installed successfully");
  } catch (error) {
    spinner.fail("Installation failed");
    throw error;
  }
}
