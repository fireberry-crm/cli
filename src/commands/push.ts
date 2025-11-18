import ora from "ora";
import chalk from "chalk";
import { getManifest, handleComponents } from "../utils/components.utils.js";
import { pushComponents } from "../api/requests.js";

export async function runPush(): Promise<void> {
  const spinner = ora("Checking manifest...").start();

  try {
    const manifest = await getManifest();
    spinner.succeed("Manifest loaded successfully");

    spinner.start("Validating and zipping components...");

    const zippedComponents = await handleComponents(manifest);

    const count = zippedComponents.length;
    if (count > 0) {
      spinner.succeed(
        `${count} component${count > 1 ? "s" : ""} validated and zipped`
      );

      console.log(chalk.cyan("\nComponents ready to push:"));
      zippedComponents.forEach((comp, idx) => {
        const sizeKB = (comp.build.length / 1024).toFixed(2);
        console.log(
          chalk.gray(`  ${idx + 1}. ${comp.title} (${comp.id}) - ${sizeKB} KB`)
        );
      });

      spinner.start("Uploading to Fireberry...");

      await pushComponents(manifest.app.id, zippedComponents);
      spinner.succeed("Components pushed successfully");
    } else {
      spinner.succeed("No components to push");
    }
  } catch (error) {
    spinner.fail("Push failed");
    throw error;
  }
}
