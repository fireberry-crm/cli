#!/usr/bin/env node
import { Command } from "commander";
import chalk from "chalk";
import { runInit } from "../commands/init.js";
import { runCreate } from "../commands/create.js";
import packageJson from "../../package.json" with { type: "json" };
import { runPush } from "../commands/push.js";
import { runInstall } from "../commands/install.js";
import { runDelete } from "../commands/delete.js";
import { runDebug } from "../commands/debug.js";
import { runCreateComponent } from "../commands/create-component.js";

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

program
  .command("create-component")
  .argument("[name]", "Component name")
  .argument("[type]", "Component type (record, global-menu, side-menu)")
  .description("Add a new component to the existing app manifest")
  .action(async (name, type) => {
   await runCreateComponent({ name, type });
});

program
  .command("push")
  .description("Push app to Fireberry")
  .action(async () => {
    await runPush();
  });

program.command("install")
    .description("Install app on your Fireberry account")
    .action(async () => {
      await runInstall();
    });

program
  .command("delete")
  .description("Delete a Fireberry app")
  .action(async () => {
    await runDelete();
  });

program
  .command("debug")
  .argument("<component-id>", "Component ID to debug")
  .argument("[url]", "Debug URL in format localhost:[port]")
  .option("--stop", "Stop debugging the component")
  .description("Start or stop debugging a component")
  .action(async (componentId: string, url?: string, options?: { stop?: boolean }) => {
    await runDebug(componentId, url, options);
  });

program.parseAsync(process.argv).catch((err: unknown) => {
  const errorMessage = err instanceof Error 
    ? err.message
    : typeof err === 'string' 
      ? err 
      : 'Unexpected error';
  
  const formattedError = errorMessage.startsWith('Error:') ? errorMessage : `Error: ${errorMessage}`;
  console.error(chalk.red(formattedError));
  process.exit(1);
});
