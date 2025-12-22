import ora from "ora";
import chalk from "chalk";
import { updateDebug } from "../api/requests.js";
import { getManifest } from "../utils/components.utils.js";
import { Manifest } from "../api/types.js";

function validateDebugUrl(url: string): void {
  const localhostPattern = /^localhost:\d+$/;

  if (!localhostPattern.test(url)) {
    throw new Error(
      "Invalid URL format. URL must be in format: localhost:[port] (e.g., localhost:3000)\n" +
        "Do not include http:// or https://"
    );
  }
}

function validateComponentExists(
  manifest: Manifest,
  componentId: string
): void {
  const component = manifest.components?.find(
    (comp: any) => comp.id === componentId
  );

  if (!component) {
    throw new Error(
      `Component with ID "${componentId}" not found in manifest.\n` +
        `Available components:\n` +
        manifest.components
          ?.map((comp: any) => `  - ${comp.title} (${comp.id})`)
          .join("\n")
    );
  }
}

export async function runDebug(
  componentId: string,
  url?: string,
  options?: { stop?: boolean }
): Promise<void> {
  const spinner = ora("Loading manifest...").start();

  try {
    const manifest = await getManifest();
    spinner.succeed("Manifest loaded");

    validateComponentExists(manifest, componentId);

    if (options?.stop) {
      spinner.start("Stopping debug mode...");
      await updateDebug(componentId, manifest);
      spinner.succeed(
        chalk.green(`Debug mode stopped for component: ${componentId}`)
      );
    } else {
      if (!url) {
        throw new Error(
          "URL is required when starting debug mode.\n" +
            `Usage: fireberry debug ${componentId} localhost:[port]`
        );
      }

      validateDebugUrl(url);

      spinner.start(`Starting debug mode for component ${componentId}...`);
      await updateDebug(componentId, manifest, url);
      spinner.succeed(
        chalk.green(
          `Debug mode started!\n` +
            `  Component: ${componentId}\n` +
            `  URL: ${url}\n\n` +
            `To stop debugging, run: ${chalk.cyan(
              `fireberry debug ${componentId} --stop`
            )}`
        )
      );
    }
  } catch (error) {
    spinner.fail(
      options?.stop ? "Failed to stop debug mode" : "Failed to start debug mode"
    );
    throw error;
  }
}
