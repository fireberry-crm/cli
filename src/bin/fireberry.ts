#!/usr/bin/env node
import { Command } from "commander";
import chalk from "chalk";
import { runInit } from "../commands/init.js";

const program = new Command();

program
  .name("fireberry")
  .description("Fireberry developer CLI")
  .version("0.0.1");

program
  .command("init")
  .argument("[tokenid]", "Fireberry token id")
  .description("Initiates credentials and stores token in local config")
  .action(async (tokenid?: string) => {
    await runInit({ tokenid });
  });

program.parseAsync(process.argv).catch((err: unknown) => {
  console.error(chalk.red((err as Error)?.message || "Unexpected error"));
  process.exit(1);
});
