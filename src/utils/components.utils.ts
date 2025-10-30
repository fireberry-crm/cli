import path from "node:path";
import fs from "fs-extra";
import yaml from "js-yaml";
import chalk from "chalk";
import * as tar from "tar";
import os from "node:os";
import { Manifest, ManifestComponent, ZippedComponent } from "../api/types.js";

export const getManifest = async (): Promise<Manifest> => {
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

export const validateComponentBuild = async (
  componentPath: string,
  comp: ManifestComponent
) => {
  if (!(await fs.pathExists(componentPath))) {
    throw new Error(
      `Component "${comp.title}" path does not exist: ${chalk.yellow(
        componentPath
      )}\n` + `Make sure the path in manifest.yml is correct.`
    );
  }

  const stats = await fs.stat(componentPath);

  if (stats.isDirectory()) {
    const files = await fs.readdir(componentPath);

    if (files.length === 0) {
      throw new Error(`Component <${comp.key}> at: /${comp.path} not found`);
    }
  }
};

export const zipComponentBuild = async (
  componentPath: string,
  title: string
): Promise<Buffer> => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "fireberry-"));
  const tarballPath = path.join(tmpDir, `${title}.tar.gz`);

  try {
    const stats = await fs.stat(componentPath);

    if (stats.isDirectory()) {
      await tar.create(
        {
          gzip: true,
          file: tarballPath,
          cwd: componentPath,
        },
        ["."]
      );
    } else {
      const tempBuildDir = path.join(tmpDir, "build");
      await fs.ensureDir(tempBuildDir);

      const fileName = path.basename(componentPath);
      await fs.copy(componentPath, path.join(tempBuildDir, fileName));

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

export const validateManifestComponents = async (manifest: Manifest) => {
  const components = manifest.components;
  if (!components || components.length === 0) {
    throw new Error("No components found in manifest");
  }

  const keys = components.map((comp) => comp.key);
  if (new Set(keys).size !== keys.length) {
    throw new Error("All component keys must be unique");
  }

  for (const comp of components) {
    const componentPath = path.join(process.cwd(), comp.path);
    await validateComponentBuild(componentPath, comp);
  }
};

export const handleComponents = async (
  manifest: Manifest
): Promise<ZippedComponent[]> => {
  await validateManifestComponents(manifest);
  const components = manifest.components!;

  const zippedComponents: ZippedComponent[] = [];

  for (const comp of components) {
    const componentPath = path.join(process.cwd(), comp.path);

    const buildBuffer = await zipComponentBuild(componentPath, comp.title);

    zippedComponents.push({
      title: comp.title,
      key: comp.key,
      build: buildBuffer,
    });
  }

  return zippedComponents;
};
