import ora from "ora";
import chalk from "chalk";
import inquirer from "inquirer";
import { deleteApp } from "../api/requests.js";

interface DeleteOptions {
  appId?: string;
}

export async function runDelete({ appId }: DeleteOptions): Promise<void> {
  let id = appId;

  if (!id) {
    const answers = await inquirer.prompt([
      {
        type: "input",
        name: "appId",
        message: "Enter the app ID to delete:",
      },
    ]);
    id = (answers.appId || "").trim();
  }

  if (!id) {
    throw new Error("App ID is required.");
  }

  const confirmAnswer = await inquirer.prompt([
    {
      type: "confirm",
      name: "confirm",
      message: `Are you sure you want to delete app ${chalk.yellow(id)}? This action cannot be undone.`,
      default: false,
    },
  ]);

  if (!confirmAnswer.confirm) {
    console.log(chalk.gray("Delete operation cancelled."));
    return;
  }

  const spinner = ora(`Deleting app "${chalk.cyan(id)}"...`).start();

  try {
    await deleteApp({ appId: id });
    spinner.succeed(`Successfully deleted app "${chalk.cyan(id)}"`);
  } catch (error) {
    spinner.fail(`Failed to delete app "${chalk.cyan(id)}"`);
    throw error;
  }
}
