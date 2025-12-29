import inquirer from "inquirer";
import path from "node:path";
import fs from "fs-extra";
import { v4 as uuidv4 } from "uuid";
import { spawnSync } from "node:child_process";
import yaml from "js-yaml";
import ora from "ora";
import chalk from "chalk";
import { createApp } from "../api/requests.js";
import { getManifest } from "../utils/components.utils.js";

interface CreateOptions {
  name?: string;
}

function slugifyName(name: string) {
  const validPattern = /^[a-zA-Z0-9_-]+$/;
  if (!validPattern.test(name)) {
    throw new Error(
      `Invalid app name: "${name}". Only alphanumeric characters, underscores, and hyphens are allowed.`
    );
  }

  return name;
}

export async function runCreate({ name }: CreateOptions): Promise<void> {
  let appName = name;

  if (!appName) {
    const answers = await inquirer.prompt([
      {
        type: "input",
        name: "name",
        message: "App name:",
      },
    ]);
    appName = (answers.name || "").trim();
  }

  if (!appName) {
    throw new Error("Missing app name.");
  }

  const slug = slugifyName(appName);
  const appId = uuidv4();
  const appDir = path.resolve(process.cwd(), slug);
  const componentName = `${slug}-component`;

  if (await fs.pathExists(appDir)) {
    throw new Error(`Already exists. ${chalk.yellow(slug)}`);
  }

  const spinner = ora(`Creating app "${chalk.cyan(appName)}"...`).start();
  const originalCwd = process.cwd();

  try {
    await fs.ensureDir(appDir);

    const initialManifest = {
      app: {
        id: appId,
        name: appName,
        description: "",
      },
      components: [],
    };

    await fs.writeFile(
      path.join(appDir, "manifest.yml"),
      yaml.dump(initialManifest, { indent: 2, lineWidth: -1, noRefs: true }),
      "utf-8"
    );

    spinner.succeed(`App directory "${chalk.cyan(appName)}" created!`);
    console.log(chalk.gray(`📁 Location: ${appDir}`));
    console.log(chalk.gray(`App ID: ${appId}`));

    process.chdir(appDir);

    console.log(chalk.cyan(`\nAdding component "${componentName}"...`));

    const createComponentResult = spawnSync(
      "fireberry",
      ["create-component", componentName],
      {
        stdio: "inherit",
        shell: true,
      }
    );

    if (createComponentResult.error || createComponentResult.status !== 0) {
      throw new Error(
        `Failed to create component: ${
          createComponentResult.error?.message ||
          `Exit code ${createComponentResult.status}`
        }`
      );
    }

    spinner.start();
    spinner.text = `Registering app with Fireberry...`;
    await createApp(await getManifest());
    spinner.succeed(`App registered with Fireberry!`);

    console.log(chalk.green(`\n🎉 Your app is ready!`));
    console.log(chalk.white(`\nNext steps:`));
    console.log(chalk.white(`   cd ${slug}`));
    console.log(chalk.white(`   fireberry push    # Push to Fireberry`));
  } catch (error) {
    spinner.fail(`Failed to create app "${chalk.cyan(appName)}"`);
    process.chdir(originalCwd);
    throw error;
  }
}
