import inquirer from "inquirer";
import envPaths from "env-paths";
import path from "node:path";
import fs from "fs-extra";
import ora from "ora";
import chalk from "chalk";

export async function runInit({ tokenid } = {}) {
  let token = tokenid;
  if (!token) {
    const answers = await inquirer.prompt([
      {
        type: "password",
        name: "token",
        message: "Enter Fireberry token id",
        mask: "*",
      },
    ]);
    token = answers.token?.trim();
  }
  if (!token) {
    throw new Error("An access token must be provided.");
  }

  const paths = envPaths("Fireberry CLI", { suffix: "" });
  const configDir = paths.config;
  const configFile = path.join(configDir, "config.json");

  const spinner = ora("Saving token to local config").start();
  try {
    await fs.ensureDir(configDir);
    const config = {
      token,
      createdAt: new Date().toISOString(),
    };
    await fs.writeJson(configFile, config, { spaces: 2 });
    spinner.succeed("Initialized. Token stored locally.");
    console.log(chalk.gray(`Config: ${configFile}`));
  } catch (err) {
    spinner.fail("Failed to save token.");
    throw err;
  }
}
