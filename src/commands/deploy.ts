import ora from "ora";
import { getManifest } from "../utils/components.utils.js";
import { deployApp } from "../api/requests.js";

export async function runDeploy(): Promise<void> {
  const spinner = ora("Loading manifest...").start();

  try {
    const manifest = await getManifest();
    const appId = manifest.app.id;

    spinner.start(`Deploying app ${appId}...`);
    await deployApp(appId);
    spinner.succeed("App deployed successfully");
  } catch (error) {
    spinner.fail("Deploy failed");
    throw error;
  }
}
