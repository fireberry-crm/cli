import inquirer from "inquirer";
import path from "node:path";
import fs from "fs-extra";
import { v4 as uuidv4 } from "uuid";
import { fileURLToPath } from "node:url";
import ora from "ora";
import chalk from "chalk";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function runCreate({ name }: CreateOptions): Promise<void> {
  let appName = name;
  if (!appName) {
    const answers = await inquirer.prompt([
      { type: "input", name: "name", message: "App name" },
    ]);
    appName = (answers.name || "").trim();
  }
  if (!appName) {
    console.error(chalk.red("Error: App name is required."));
    throw new Error("App name is required.");
  }

  const slug = slugifyName(appName);
  const appId = uuidv4();
  const appDir = path.resolve(process.cwd(), slug);

  if (await fs.pathExists(appDir)) {
    console.error(
      chalk.red(`Error: Directory already exists: ${chalk.yellow(appDir)}`)
    );
    throw new Error(`Directory already exists: ${appDir}`);
  }

  const spinner = ora(`Creating app "${chalk.cyan(appName)}"...`).start();

  try {
    await fs.ensureDir(appDir);

    const templatesDir = path.join(__dirname, "..", "..", "src", "templates");
    const manifestTemplate = await fs.readFile(
      path.join(templatesDir, "manifest.yml"),
      "utf-8"
    );
    const htmlTemplate = await fs.readFile(
      path.join(templatesDir, "index.html"),
      "utf-8"
    );

    const manifestContent = manifestTemplate
      .replace(/{{appName}}/g, appName)
      .replace(/{ { appId } }/g, appId);

    const htmlContent = htmlTemplate.replace(/{{appName}}/g, appName);

    await fs.writeFile(path.join(appDir, "manifest.yml"), manifestContent);
    await fs.writeFile(path.join(appDir, "index.html"), htmlContent);

    spinner.succeed(`Successfully created "${chalk.cyan(appName)}" app!`);
    console.log(chalk.gray(`📁 Location: ${appDir}`));
    console.log(chalk.gray(`App ID: ${appId}`));
    console.log(chalk.green("\n🎉 Your app is ready! Next steps:"));
    console.log(chalk.white(`   cd ${slug}`));
    console.log(chalk.white("   # Start developing your Fireberry app"));
  } catch (error) {
    spinner.fail(`Failed to create app "${chalk.cyan(appName)}"`);
    console.error(
      chalk.red(
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`
      )
    );
    throw error;
  }
}
