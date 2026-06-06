import inquirer from "inquirer";
import path from "node:path";
import fs from "fs-extra";
import { v4 as uuidv4 } from "uuid";
import yaml from "js-yaml";
import ora from "ora";
import chalk from "chalk";
import { getManifest } from "../utils/components.utils.js";
import { slugifyName } from "../utils/app.utils.js";
import { Manifest, UntypedManifestComponent } from "../api/types.js";

interface MarketplaceCloneOptions {
  dest?: string;
}

const IGNORED_PATHS = new Set(["node_modules"]);

export async function runMarketplaceClone({
  dest,
}: MarketplaceCloneOptions): Promise<void> {
  // Must be run from the app root (where manifest.yml lives).
  const manifest = (await getManifest()) as Manifest;

  let destFolder = dest;

  if (!destFolder) {
    const answers = await inquirer.prompt([
      {
        type: "input",
        name: "dest",
        message: "Destination folder:",
      },
    ]);
    destFolder = (answers.dest || "").trim();
  }

  if (!destFolder) {
    throw new Error("Missing destination folder.");
  }

  const folderName = path.basename(destFolder);
  const sourceDir = process.cwd();
  const destDir = path.resolve(sourceDir, destFolder);

  if (destDir === sourceDir) {
    throw new Error(
      "Destination folder must be different from the source folder."
    );
  }

  // Allow cloning into an existing empty folder; reject only if it has files.
  if (await fs.pathExists(destDir)) {
    const stats = await fs.stat(destDir);
    if (!stats.isDirectory()) {
      throw new Error(`Already exists. ${chalk.yellow(destFolder)}`);
    }
    const existingEntries = await fs.readdir(destDir);
    if (existingEntries.length > 0) {
      throw new Error(`Folder is not empty. ${chalk.yellow(destFolder)}`);
    }
  }

  const spinner = ora(
    `Cloning app into "${chalk.cyan(destFolder)}"...`
  ).start();

  try {
    // Clone all files into the destination folder, skipping node_modules and
    // the destination itself (to avoid recursive copies).
    await fs.copy(sourceDir, destDir, {
      filter: (src) => {
        if (src === destDir) {
          return false;
        }
        return !IGNORED_PATHS.has(path.basename(src));
      },
    });

    // Regenerate ids for the cloned manifest (application + components).
    const appId = uuidv4();
    const clonedManifest: Manifest = {
      ...manifest,
      app: {
        ...manifest.app,
        id: appId,
      },
    };

    const components = manifest.components as unknown as
      | UntypedManifestComponent[]
      | undefined;

    if (components?.length) {
      clonedManifest.components = components.map((comp) => ({
        ...comp,
        id: uuidv4(),
      })) as unknown as Manifest["components"];
    }

    await fs.writeFile(
      path.join(destDir, "manifest.yml"),
      yaml.dump(clonedManifest, { indent: 2, lineWidth: -1, noRefs: true }),
      "utf-8"
    );

    spinner.succeed(`App cloned into "${chalk.cyan(destFolder)}"!`);
    console.log(chalk.gray(`📁 Location: ${destDir}`));
    console.log(chalk.gray(`App ID: ${appId}`));

    console.log(chalk.green(`\n🎉 Your cloned marketplace app is ready!`));
    console.log(chalk.white(`You can start working in ${chalk.cyan(folderName)}`));
  } catch (error) {
    spinner.fail(`Failed to clone app into "${chalk.cyan(destFolder)}"`);
    throw error;
  }
}
