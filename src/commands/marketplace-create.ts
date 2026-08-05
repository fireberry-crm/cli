import inquirer from "inquirer";
import path from "node:path";
import fs from "fs-extra";
import { v4 as uuidv4 } from "uuid";
import yaml from "js-yaml";
import ora from "ora";
import chalk from "chalk";
import { slugifyName } from "../utils/app.utils.js";
import { runCreateComponent } from "./create-component.js";

interface MarketplaceCreateOptions {
  name?: string;
}

export async function runMarketplaceCreate({
  name,
}: MarketplaceCreateOptions): Promise<void> {
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

    await runCreateComponent({ name: componentName });

    console.log(chalk.green(`\n🎉 Your marketplace app is ready!`));
    console.log(chalk.white(`\nNext steps:`));
    console.log(chalk.white(`   cd ${slug}`));
  } catch (error) {
    spinner.fail(`Failed to create app "${chalk.cyan(appName)}"`);
    process.chdir(originalCwd);
    throw error;
  }
}
