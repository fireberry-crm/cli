#!/usr/bin/env node
import { Command } from "commander";
import chalk from "chalk";
import { runInit } from "../commands/init.js";
import { runCreate } from "../commands/create.js";
import packageJson from "../../package.json" with { type: "json" };

const program = new Command();

program
  .name("fireberry")
  .description("Fireberry developer CLI")
  .version(packageJson.version);

program
  .command("init")
  .argument("[tokenid]", "Fireberry token id")
  .description("Initiates credentials and stores token in local config")
  .action(async (tokenid?: string) => {
    await runInit({ tokenid });
  });

program
  .command("create")
  .argument("[name...]", "App name")
  .description("Create a new Fireberry app")
  .action(async (nameArgs?: string[]) => {
    const name = nameArgs ? nameArgs.join("-") : undefined;
    await runCreate({ name });
  });

program.parseAsync(process.argv).catch((err: unknown) => {
  const errorMessage = err instanceof Error 
    ? err.message
    : typeof err === 'string' 
      ? err 
      : 'Unexpected error';
  console.error(chalk.red(errorMessage));
  process.exit(1);
});
