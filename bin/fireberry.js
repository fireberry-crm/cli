#!/usr/bin/env node
import { Command } from "commander";
import chalk from "chalk";
import { runInit } from "../src/commands/init.js";

const program = new Command();

program
  .name("fireberry")
  .description("Fireberry developer CLI")
  .version("0.0.1");

program
  .command("init")
  .argument("[tokenid]", "Fireberry token id")
  .description("Initiates credentials and stores token in local config")
  .action(async (tokenid) => {
    await runInit({ tokenid });
  });

program.parseAsync(process.argv).catch((err) => {
  console.error(chalk.red(err?.message || "Unexpected error"));
  process.exit(1);
});
