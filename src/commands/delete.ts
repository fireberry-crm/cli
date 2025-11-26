import ora from "ora";
import chalk from "chalk";
import inquirer from "inquirer";
import { deleteApp } from "../api/requests.js";
import { getManifest } from "../utils/components.utils.js";

export async function runDelete(): Promise<void> {
  const spinner = ora("Loading manifest...").start();

  try {
    const manifest = await getManifest();
    spinner.stop();

    const confirmAnswer = await inquirer.prompt([
      {
        type: "confirm",
        name: "confirm",
        message: `Are you sure you want to delete app ${chalk.yellow(
          manifest.app.name
        )} (${chalk.gray(manifest.app.id)})? This action cannot be undone.`,
        default: false,
      },
    ]);

    if (!confirmAnswer.confirm) {
      console.log(chalk.gray("Delete operation cancelled."));
      return;
    }

    spinner.start(`Deleting app "${chalk.cyan(manifest.app.name)}"...`);

    await deleteApp(manifest);
    spinner.succeed(
      `Successfully deleted app "${chalk.cyan(manifest.app.name)}"`
    );
  } catch (error) {
    spinner.fail("Failed to delete app");
    throw error;
  }
}
