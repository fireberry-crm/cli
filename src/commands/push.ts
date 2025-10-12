import ora from "ora";
import path from "node:path";
import fs from "fs-extra";
import yaml from "js-yaml";
import chalk from "chalk";

interface ManifestApp {
  id: string;
  name: string;
  description?: string;
}

interface ManifestComponent {
  type: string;
  title: string;
  key: string;
  path: string;
  settings?: Record<string, unknown>;
}

interface Manifest {
  app: ManifestApp;
  components?: ManifestComponent[];
}

const getManifest = async (): Promise<Manifest> => {
  const manifestPath = path.join(process.cwd(), "manifest.yml");

  if (!(await fs.pathExists(manifestPath))) {
    throw new Error(
      `No manifest.yml found at ${chalk.yellow(process.cwd())}.\n` +
        `Please run this command from your Fireberry app directory.`
    );
  }

  const manifestContent = await fs.readFile(manifestPath, "utf-8");

  const manifest = yaml.load(manifestContent) as Manifest;

  if (!manifest || !manifest.app) {
    throw new Error("manifest.yml must contain an 'app' section");
  }

  if (!manifest.app.id || !manifest.app.name) {
    throw new Error(
      "manifest.yml app section must contain 'id' and 'name' fields"
    );
  }

  return manifest;
};

export async function runPush(): Promise<void> {
  const spinner = ora("Checking manifest...").start();

  try {
    const manifest = await getManifest();
    spinner.succeed("Manifest loaded successfully");

    if (manifest.components && manifest.components.length > 0) {
      spinner.start("Validating component paths...");

      for (const comp of manifest.components) {
        const componentPath = path.join(process.cwd(), comp.path);
        if (!(await fs.pathExists(componentPath))) {
          throw new Error(
            `Component "${comp.title}" path does not exist: ${chalk.yellow(
              componentPath
            )}\n` + `Make sure the build folder exists at the specified path.`
          );
        }
      }

      spinner.succeed(
        `All component paths validated (${
          manifest.components.length
        } component${manifest.components.length > 1 ? "s" : ""})`
      );
    }
  } catch (error) {
    spinner.fail("Push failed");
    throw error;
  }
}
