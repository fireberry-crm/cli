import inquirer, { QuestionCollection } from "inquirer";
import path from "node:path";
import fs from "fs-extra";
import { v4 as uuidv4 } from "uuid";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import ora from "ora";
import chalk from "chalk";
import yaml from "js-yaml";
import { getManifest } from "../utils/components.utils.js";
import { COMPONENT_TYPE, ComponentType } from "../constants/component-types.js";

import { HEIGHT_OPTIONS } from "../constants/height-options.js";
import { UntypedManifestComponent } from "../api/types.js";
const __filename = fileURLToPath(import.meta.url);

const __dirname = path.dirname(__filename);
interface CreateComponentOptions {
  name?: string;
  type?: string;
}

const VALID_COMPONENT_TYPES = Object.values(COMPONENT_TYPE);

function validateComponentType(type: string): ComponentType {
  if (!VALID_COMPONENT_TYPES.includes(type as ComponentType)) {
    throw new Error(
      `Invalid component type: "${type}". Valid types are: ${VALID_COMPONENT_TYPES.join(
        ", "
      )}`
    );
  }
  return type as ComponentType;
}

async function promptForSettings(
  type: ComponentType
): Promise<Record<string, unknown>> {
  switch (type) {
    case COMPONENT_TYPE.RECORD: {
      const answers = await inquirer.prompt([
        {
          type: "number",
          name: "objectType",
          message: "Object type:",
          default: 0,
        },
        {
          type: "list",
          name: "height",
          message: "Component height:",
          choices: HEIGHT_OPTIONS,
          default: "M",
        },
      ]);
      return {
        ...answers,
        iconName: "related-single",
        iconColor: "#7aae7f",
      };
    }
    case COMPONENT_TYPE.GLOBAL_MENU: {
      const answers = await inquirer.prompt([
        {
          type: "input",
          name: "displayName",
          message: "Display name:",
          default: "Global Menu",
        },
      ]);
      return {
        ...answers,
        iconName: "related-single",
      };
    }
    case COMPONENT_TYPE.SIDE_MENU: {
      const answers = await inquirer.prompt([
        {
          type: "list",
          name: "width",
          message: "Component width:",
          choices: ["S", "M", "L"],
          default: "M",
        },
      ]);
      return {
        ...answers,
        iconName: "related-single",
      };
    }
    default:
      return {};
  }
}

export async function runCreateComponent({
  type,
  name,
}: CreateComponentOptions): Promise<void> {
  let componentName = name;
  let componentType = type;

  const manifestPath = path.join(process.cwd(), "manifest.yml");
  const manifest = await getManifest();

  const components = manifest.components as unknown as
    | UntypedManifestComponent[]
    | undefined;

  const existingComponent = components?.find(
    (comp) => comp.title === componentName
  );
  if (existingComponent) {
    throw new Error(
      `Component with name "${componentName}" already exists in manifest.yml`
    );
  }

  if (!componentName || !componentType) {
    const questions: QuestionCollection<{ name: string; type: string }>[] = [];

    if (!componentName) {
      questions.push({
        type: "input",
        name: "name",
        message: "Component name:",
      });
    }

    if (!componentType) {
      questions.push({
        type: "list",
        name: "type",
        message: "Component type:",
        choices: VALID_COMPONENT_TYPES,
      });
    }

    const answers = await inquirer.prompt(questions);

    if (!componentName) {
      componentName = (answers.name || "").trim();
    }
    if (!componentType) {
      componentType = answers.type;
    }
  }

  if (!componentName) {
    throw new Error("Missing component name.");
  }

  if (!componentType) {
    throw new Error("Missing component type.");
  }

  const validatedType = validateComponentType(componentType);

  const spinner = ora();

  try {
    const componentSettings = await promptForSettings(validatedType);

    spinner.text = chalk.cyan(
      `Creating Vite React app for "${chalk.cyan(componentName)}"...`
    );
    spinner.start();

    const componentDir = path.join(process.cwd(), componentName);
    await fs.ensureDir(componentDir);

    // Create Vite app with React template
    spinner.text = `Running npm create vite@latest...`;
    const viteResult = spawnSync(
      `npm create vite@latest ${componentName} -- --template react --no-interactive`,
      {
        cwd: process.cwd(),
        stdio: "inherit",
        shell: true,
      }
    );

    if (viteResult.error || viteResult.status !== 0) {
      throw new Error(
        `Failed to create Vite app: ${
          viteResult.error?.message || `Exit code ${viteResult.status}`
        }`
      );
    }

    spinner.text = `Installing dependencies...`;
    const installResult = spawnSync("npm install", {
      cwd: componentDir,
      stdio: "inherit",
      shell: true,
    });

    if (installResult.error || installResult.status !== 0) {
      throw new Error("Failed to install dependencies");
    }

    spinner.text = `Installing Fireberry packages...`;
    const fireberryResult = spawnSync(
      "npm install @fireberry/ds @fireberry/sdk",
      {
        cwd: componentDir,
        stdio: "inherit",
        shell: true,
      }
    );

    if (fireberryResult.error || fireberryResult.status !== 0) {
      throw new Error("Failed to install Fireberry packages");
    }
    spinner.text = `Configuring component...`;

    const templatesDir = path.join(__dirname, "..", "..", "src", "templates");

    // Choose the right App.jsx template based on component type
    const appTemplateFile =
      validatedType === COMPONENT_TYPE.RECORD
        ? "App-record.jsx"
        : "App-other.jsx";
    const appTemplate = await fs.readFile(
      path.join(templatesDir, appTemplateFile),
      "utf-8"
    );
    await fs.writeFile(path.join(componentDir, "src", "App.jsx"), appTemplate);

    // Build the component
    spinner.text = `Building component...`;
    const buildResult = spawnSync("npm run build", {
      cwd: componentDir,
      stdio: "inherit",
      shell: true,
    });

    if (buildResult.error || buildResult.status !== 0) {
      throw new Error("Failed to build component");
    }

    spinner.text = `Adding component to manifest...`;

    const componentId = uuidv4();

    const newComponent: UntypedManifestComponent = {
      type: validatedType,
      title: componentName,
      id: componentId,
      path: `${componentName}/dist`,
      settings: componentSettings,
    };

    if (!manifest.components) {
      manifest.components = [];
    }

    (manifest.components as unknown as UntypedManifestComponent[]).push(
      newComponent
    );

    const updatedYaml = yaml.dump(manifest, {
      indent: 2,
      lineWidth: -1,
      noRefs: true,
    });

    await fs.writeFile(manifestPath, updatedYaml, "utf-8");

    spinner.succeed(
      `Successfully created component "${chalk.cyan(componentName)}"!`
    );
    console.log(chalk.gray(`Component ID: ${componentId}`));
    console.log(chalk.gray(`Type: ${validatedType}`));
    console.log(chalk.gray(`Path: ${componentName}/dist`));
    console.log(chalk.green("\n🎉 Your component is ready!"));
    console.log(chalk.white(`   cd ${componentName}`));
    console.log(chalk.white(`   npm run dev    # Start development server`));
    console.log(chalk.white(`   npm run build  # Build for production`));
  } catch (error) {
    if (error instanceof Error) {
      spinner.fail(chalk.red(`Failed to add component: ${error.message}`));
    } else {
      spinner.fail(
        chalk.red(
          `Failed to add component "${chalk.cyan(componentName || "unknown")}"`
        )
      );
    }
    throw error;
  }
}
