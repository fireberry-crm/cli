import path from "node:path";
import fs from "fs-extra";
import yaml from "js-yaml";
import chalk from "chalk";
import * as tar from "tar";
import os from "node:os";
import {
  Manifest,
  ZippedComponent,
  UntypedManifestComponent,
  RecordComponentSettings,
  GlobalMenuComponentSettings,
  SideMenuComponentSettings,
} from "../api/types.js";
import { COMPONENT_TYPE } from "../constants/component-types.js";
import { HEIGHT_OPTIONS } from "../constants/height-options.js";

export const getManifest = async (basePath?: string): Promise<Manifest> => {
  const manifestPath = path.join(basePath || process.cwd(), "manifest.yml");
  const searchDir = basePath || process.cwd();

  if (!(await fs.pathExists(manifestPath))) {
    throw new Error(
      `No manifest.yml found at ${chalk.yellow(searchDir)}.\n` +
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

const validateRecordComponentSettings = (
  comp: UntypedManifestComponent
): void => {
  const settings = comp.settings as
    | Partial<RecordComponentSettings>
    | undefined;

  if (!settings) {
    throw new Error(
      `Component "${comp.title}" (type: ${COMPONENT_TYPE.RECORD}) is missing required settings`
    );
  }

  const requiredFields: (keyof RecordComponentSettings)[] = [
    "iconName",
    "iconColor",
    "objectType",
    "height",
  ];

  for (const fieldName of requiredFields) {
    if (settings[fieldName] === undefined || settings[fieldName] === null) {
      throw new Error(
        `Component "${comp.title}" (type: ${COMPONENT_TYPE.RECORD}) is missing required setting: ${fieldName}`
      );
    }
  }

  if (typeof settings.iconName !== "string") {
    throw new Error(
      `Component "${comp.title}" (type: ${COMPONENT_TYPE.RECORD}) setting "iconName" must be a string`
    );
  }

  if (typeof settings.iconColor !== "string") {
    throw new Error(
      `Component "${comp.title}" (type: ${COMPONENT_TYPE.RECORD}) setting "iconColor" must be a string`
    );
  }

  if (typeof settings.objectType !== "number") {
    throw new Error(
      `Component "${comp.title}" (type: ${COMPONENT_TYPE.RECORD}) setting "objectType" must be a number`
    );
  }
  if (!settings.height) {
    throw new Error(
      `Component "${comp.title}" (type: ${
        COMPONENT_TYPE.RECORD
      }) setting "height" must be one of: ${HEIGHT_OPTIONS.join(" | ")}`
    );
  }

  if (!HEIGHT_OPTIONS.includes(settings.height as any)) {
    throw new Error(
      `Component "${comp.title}" (type: ${
        COMPONENT_TYPE.RECORD
      }) setting "height" must be one of: ${HEIGHT_OPTIONS.join(" | ")}`
    );
  }
};

const validateGlobalMenuComponentSettings = (
  comp: UntypedManifestComponent
): void => {
  const settings = comp.settings as
    | Partial<GlobalMenuComponentSettings>
    | undefined;

  if (!settings) {
    throw new Error(
      `Component "${comp.title}" (type: ${COMPONENT_TYPE.GLOBAL_MENU}) is missing required settings`
    );
  }

  if (!settings.displayName) {
    throw new Error(
      `Component "${comp.title}" (type: ${COMPONENT_TYPE.GLOBAL_MENU}) is missing required setting: displayName`
    );
  }

  if (typeof settings.displayName !== "string") {
    throw new Error(
      `Component "${comp.title}" (type: ${COMPONENT_TYPE.GLOBAL_MENU}) setting "displayName" must be a string`
    );
  }

  if (settings.iconName && typeof settings.iconName !== "string") {
    throw new Error(
      `Component "${comp.title}" (type: ${COMPONENT_TYPE.GLOBAL_MENU}) setting "iconName" must be a string`
    );
  }
};

const validateSideMenuComponentSettings = (
  comp: UntypedManifestComponent
): void => {
  const settings = comp.settings as
    | Partial<SideMenuComponentSettings>
    | undefined;

  if (!settings) {
    throw new Error(
      `Component "${comp.title}" (type: ${COMPONENT_TYPE.SIDE_MENU}) is missing required settings`
    );
  }

  if (!settings.iconName) {
    throw new Error(
      `Component "${comp.title}" (type: ${COMPONENT_TYPE.SIDE_MENU}) setting "iconName" must be a string`
    );
  }

  if (!settings.width) {
    throw new Error(
      `Component "${comp.title}" (type: ${COMPONENT_TYPE.SIDE_MENU}) setting "width" must be a S | M | L`
    );
  }

  if (
    settings.width !== "S" &&
    settings.width !== "M" &&
    settings.width !== "L"
  ) {
    throw new Error(
      `Component "${comp.title}" (type: ${COMPONENT_TYPE.SIDE_MENU}) setting "width" must be a S | M | L`
    );
  }
};

const validateComponentSettings = (comp: UntypedManifestComponent): void => {
  switch (comp.type) {
    case COMPONENT_TYPE.RECORD:
      validateRecordComponentSettings(comp);
      break;
    case COMPONENT_TYPE.GLOBAL_MENU:
      validateGlobalMenuComponentSettings(comp);
      break;
    case COMPONENT_TYPE.SIDE_MENU:
      validateSideMenuComponentSettings(comp);
      break;
    default:
      throw new Error(
        `Component "${comp.title}" has unsupported type: ${comp.type}. Supported types: ${COMPONENT_TYPE.RECORD}, ${COMPONENT_TYPE.GLOBAL_MENU}`
      );
  }
};

export const validateComponentBuild = async (
  componentPath: string,
  comp: UntypedManifestComponent
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
      throw new Error(`Component <${comp.id}> at: /${comp.path} not found`);
    }
  }

  validateComponentSettings(comp);
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
  const components = manifest.components as unknown as
    | UntypedManifestComponent[]
    | undefined;
  if (!components || components.length === 0) {
    throw new Error("No components found in manifest");
  }

  const ids = components.map((comp) => comp.id);
  if (new Set(ids).size !== ids.length) {
    throw new Error("All component ids must be unique");
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
  const components =
    manifest.components as unknown as UntypedManifestComponent[];

  const zippedComponents: ZippedComponent[] = [];

  for (const comp of components) {
    const componentPath = path.join(process.cwd(), comp.path);

    const buildBuffer = await zipComponentBuild(componentPath, comp.title);

    zippedComponents.push({
      title: comp.title,
      id: comp.id,
      build: buildBuffer,
    });
  }

  return zippedComponents;
};
