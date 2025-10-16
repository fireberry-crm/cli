import ora from "ora";
import path from "node:path";
import fs from "fs-extra";
import yaml from "js-yaml";
import chalk from "chalk";
import * as tar from "tar";
import os from "node:os";
import { Manifest, ZippedComponent } from "../api/types.js";
import { requests } from "../api/requests.js";

const getManifest = async (): Promise<Manifest> => {
  const manifestPath = path.join(process.cwd(), "manifest.yml");

  if (!(await fs.pathExists(manifestPath))) {
    throw new Error(
      `No manifest.yml found at ${chalk.yellow(process.cwd())}.\n` +
        `Please run this command from your Fireberry app directory.`
    );
  }

  const manifestContent = await fs.readFile(manifestPath, "utf-8");

  const manifest = yaml.load(manifestContent) as Manifest;

  if (!manifest || !manifest.app) {
    throw new Error("manifest.yml must contain an 'app' section");
  }

  if (!manifest.app.id || !manifest.app.name) {
    throw new Error(
      "manifest.yml app section must contain 'id' and 'name' fields"
    );
  }

  return manifest;
};

const validateComponentBuild = async (componentPath: string, title: string) => {
  if (!(await fs.pathExists(componentPath))) {
    throw new Error(
      `Component "${title}" path does not exist: ${chalk.yellow(
        componentPath
      )}\n` + `Make sure the path in manifest.yml is correct.`
    );
  }

  const stats = await fs.stat(componentPath);

  // If it's a directory, check it's not empty
  if (stats.isDirectory()) {
    const files = await fs.readdir(componentPath);
    if (files.length === 0) {
      throw new Error(
        `Component "${title}" directory is empty: ${chalk.yellow(
          componentPath
        )}\n` + `Make sure you've built your component.`
      );
    }
  }
  // If it's a file, that's also valid - we'll handle it in zipComponentBuild
};

const zipComponentBuild = async (
  componentPath: string,
  title: string
): Promise<Buffer> => {
  // Create temp directory for the tar.gz file
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "fireberry-"));
  const tarballPath = path.join(tmpDir, `${title}.tar.gz`);

  try {
    const stats = await fs.stat(componentPath);

    if (stats.isDirectory()) {
      // Archive the entire directory
      await tar.create(
        {
          gzip: true,
          file: tarballPath,
          cwd: componentPath,
        },
        ["."] // Archive everything in the directory
      );
    } else {
      // It's a single file - create a temp directory structure
      const tempBuildDir = path.join(tmpDir, "build");
      await fs.ensureDir(tempBuildDir);

      // Copy the file to the temp directory
      const fileName = path.basename(componentPath);
      await fs.copy(componentPath, path.join(tempBuildDir, fileName));

      // Archive the temp directory
      await tar.create(
        {
          gzip: true,
          file: tarballPath,
          cwd: tempBuildDir,
        },
        ["."]
      );
    }

    const buffer = await fs.readFile(tarballPath);

    await fs.remove(tmpDir);

    return buffer;
  } catch (error) {
    await fs.remove(tmpDir);
    throw error;
  }
};

const handleComponents = async (
  manifest: Manifest
): Promise<ZippedComponent[]> => {
  const components = manifest.components;
  if (!components || components.length === 0) {
    return [];
  }

  const keys = components.map((comp) => comp.key);
  if (new Set(keys).size !== keys.length) {
    throw new Error("All component keys must be unique");
  }

  const zippedComponents: ZippedComponent[] = [];

  for (const comp of components) {
    const componentPath = path.join(process.cwd(), comp.path);

    await validateComponentBuild(componentPath, comp.title);

    const buildBuffer = await zipComponentBuild(componentPath, comp.title);

    zippedComponents.push({
      title: comp.title,
      key: comp.key,
      build: buildBuffer,
    });
  }

  return zippedComponents;
};

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
          chalk.gray(`  ${idx + 1}. ${comp.title} (${comp.key}) - ${sizeKB} KB`)
        );
      });

      spinner.start("Uploading to Fireberry...");

      await requests.pushComponents(manifest.app.id, zippedComponents);
      spinner.info("Upload not yet implemented");
    } else {
      spinner.succeed("No components to push");
    }
  } catch (error) {
    spinner.fail("Push failed");
    throw error;
  }
}
