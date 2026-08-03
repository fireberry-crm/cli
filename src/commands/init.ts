import inquirer from "inquirer";
import ora from "ora";
import chalk from "chalk";
import {
  getConfigPath,
  listProfiles,
  switchProfile,
  upsertProfile,
  writeLegacyConfig,
} from "../profiles/store.js";

interface InitOptions {
  tokenid?: string;
  alias?: string;
  list?: boolean;
  use?: string;
}

export interface Config {
  apiToken: string;
  createdAt: string;
}

async function promptForToken(message: string): Promise<string> {
  const answers = await inquirer.prompt([
    {
      type: "password",
      name: "token",
      message,
      mask: "*",
    },
  ]);
  return (answers.token || "").trim();
}

async function runListProfiles(): Promise<void> {
  const summary = await listProfiles();
  if (summary.profiles.length === 0) {
    console.log(
      chalk.yellow(
        "No profiles configured. Run `fireberry init` to add a token."
      )
    );
    return;
  }
  console.log(chalk.cyan("Profiles:"));
  for (const alias of summary.profiles) {
    const marker = alias === summary.activeProfile ? chalk.green("*") : " ";
    console.log(`  ${marker} ${alias}`);
  }
  console.log(chalk.gray(`Active: ${summary.activeProfile}`));
  console.log(chalk.gray(`Config: ${getConfigPath()}`));
}

async function runUseProfile(alias: string): Promise<void> {
  const spinner = ora(`Switching active profile to "${alias}"...`).start();
  try {
    await switchProfile(alias);
    spinner.succeed(`Active profile: ${chalk.cyan(alias)}`);
  } catch (err) {
    spinner.fail(`Failed to switch profile`);
    throw err;
  }
}

async function runAliasInit(
  alias: string,
  providedToken?: string
): Promise<void> {
  let token = providedToken?.trim();
  if (!token) {
    token = await promptForToken(`Enter Fireberry token id for "${alias}"`);
  }
  if (!token) {
    throw new Error("An access token must be provided.");
  }

  const spinner = ora(`Saving profile "${alias}" to local config`).start();
  try {
    await upsertProfile(alias, token, { setActive: true });
    spinner.succeed(
      `Profile "${chalk.cyan(alias)}" saved and set as active.`
    );
    console.log(chalk.gray(`Config: ${getConfigPath()}`));
  } catch (err) {
    spinner.fail(`Failed to save profile "${alias}".`);
    throw err;
  }
}

async function runLegacyInit(providedToken?: string): Promise<void> {
  let token = providedToken?.trim();
  if (!token) {
    token = await promptForToken("Enter Fireberry token id");
  }
  if (!token) {
    throw new Error("An access token must be provided.");
  }

  const spinner = ora("Saving API Token to local config").start();
  try {
    const configFile = await writeLegacyConfig(token);
    spinner.succeed("Initialized. Token stored locally.");
    console.log(chalk.gray(`Config: ${configFile}`));
  } catch (err) {
    spinner.fail("Failed to save token.");
    throw err;
  }
}

export async function runInit({
  tokenid,
  alias,
  list,
  use,
}: InitOptions = {}): Promise<void> {
  if (list) {
    await runListProfiles();
    return;
  }
  if (use) {
    await runUseProfile(use.trim());
    return;
  }
  if (alias && alias.trim()) {
    await runAliasInit(alias.trim(), tokenid);
    return;
  }
  await runLegacyInit(tokenid);
}
