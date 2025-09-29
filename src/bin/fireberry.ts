#!/usr/bin/env node
import { Command } from "commander";
import chalk from "chalk";
import { runInit } from "../commands/init.js";
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

program.parseAsync(process.argv).catch((err: unknown) => {
  const errorMessage = err instanceof Error 
    ? err.message
    : typeof err === 'string' 
      ? err 
      : 'Unexpected error';
  console.error(chalk.red(errorMessage));
  process.exit(1);
});
