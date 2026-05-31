import { z } from "zod";
import path from "node:path";
import fs from "fs-extra";
import yaml from "js-yaml";
import { v4 as uuidv4 } from "uuid";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type {
  Manifest,
  UntypedManifestComponent,
} from "../../api/types.js";
import { COMPONENT_TYPE } from "../../constants/component-types.js";
import { HEIGHT_OPTIONS } from "../../constants/height-options.js";
import { createApp } from "../../api/requests.js";
import {
  DomainError,
  toErrorResult,
  toSuccessResult,
} from "../lib/mcp-errors.js";
import { makeLogger, type SendNotificationFn } from "../lib/logging.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const COMPONENT_TYPES = [
  COMPONENT_TYPE.RECORD,
  COMPONENT_TYPE.GLOBAL_MENU,
  COMPONENT_TYPE.SIDE_MENU,
] as const;

const WidthSchema = z.enum(["S", "M", "L"]);
const HeightSchema = z.enum(HEIGHT_OPTIONS);

const RecordSettingsSchema = z.object({
  objectType: z.number().int(),
  height: HeightSchema,
  iconName: z.string().default("related-single"),
  iconColor: z.string().default("#7aae7f"),
});

const GlobalMenuSettingsSchema = z.object({
  displayName: z.string().min(1),
  iconName: z.string().default("related-single"),
});

const SideMenuSettingsSchema = z.object({
  width: WidthSchema,
  iconName: z.string().default("related-single"),
});

function sanitizeComponentName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

interface SpawnOutcome {
  exitCode: number | null;
  stdoutTail: string;
  stderrTail: string;
}

const TAIL_LIMIT = 8 * 1024;

function tailJoin(prev: string, chunk: string): string {
  const next = prev + chunk;
  if (next.length <= TAIL_LIMIT) return next;
  return next.slice(next.length - TAIL_LIMIT);
}

async function runPiped(
  command: string,
  args: string[],
  options: { cwd: string },
  onLine: (stream: "stdout" | "stderr", line: string) => Promise<void>
): Promise<SpawnOutcome> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      stdio: ["ignore", "pipe", "pipe"],
      shell: true,
    });

    let stdoutTail = "";
    let stderrTail = "";
    let stdoutBuf = "";
    let stderrBuf = "";

    const flush = async (
      stream: "stdout" | "stderr",
      data: string,
      isFinal: boolean
    ) => {
      const combined = (stream === "stdout" ? stdoutBuf : stderrBuf) + data;
      const lines = combined.split(/\r?\n/);
      const remainder = isFinal ? "" : lines.pop() ?? "";
      if (stream === "stdout") {
        stdoutBuf = remainder;
      } else {
        stderrBuf = remainder;
      }
      for (const raw of lines) {
        const line = raw.trim();
        if (!line) continue;
        if (stream === "stdout") {
          stdoutTail = tailJoin(stdoutTail, line + "\n");
        } else {
          stderrTail = tailJoin(stderrTail, line + "\n");
        }
        try {
          await onLine(stream, line);
        } catch {
          // do not let logging break the pipe
        }
      }
    };

    child.stdout?.setEncoding("utf-8");
    child.stderr?.setEncoding("utf-8");

    child.stdout?.on("data", (data: string) => {
      void flush("stdout", data, false);
    });
    child.stderr?.on("data", (data: string) => {
      void flush("stderr", data, false);
    });

    child.on("error", (err) => reject(err));
    child.on("close", async (code) => {
      await flush("stdout", "", true);
      await flush("stderr", "", true);
      resolve({ exitCode: code, stdoutTail, stderrTail });
    });
  });
}

function validateSettings(
  type: (typeof COMPONENT_TYPES)[number],
  settings: unknown
): Record<string, unknown> {
  if (type === COMPONENT_TYPE.RECORD) {
    const parsed = RecordSettingsSchema.safeParse(settings);
    if (!parsed.success) {
      throw new DomainError({
        code: "invalid_settings",
        message: `Invalid settings for "record" component: ${parsed.error.message}`,
        hint: 'Required: { objectType: number, height: "S" | "M" | "L" | "XL" }. iconName/iconColor are optional.',
      });
    }
    return parsed.data as Record<string, unknown>;
  }
  if (type === COMPONENT_TYPE.GLOBAL_MENU) {
    const parsed = GlobalMenuSettingsSchema.safeParse(settings);
    if (!parsed.success) {
      throw new DomainError({
        code: "invalid_settings",
        message: `Invalid settings for "global-menu" component: ${parsed.error.message}`,
        hint: "Required: { displayName: string }. iconName is optional.",
      });
    }
    return parsed.data as Record<string, unknown>;
  }
  if (type === COMPONENT_TYPE.SIDE_MENU) {
    const parsed = SideMenuSettingsSchema.safeParse(settings);
    if (!parsed.success) {
      throw new DomainError({
        code: "invalid_settings",
        message: `Invalid settings for "side-menu" component: ${parsed.error.message}`,
        hint: 'Required: { width: "S" | "M" | "L" }. iconName is optional.',
      });
    }
    return parsed.data as Record<string, unknown>;
  }
  throw new DomainError({
    code: "invalid_type",
    message: `Unsupported component type: ${type}`,
  });
}

async function loadManifest(manifestPath: string): Promise<Manifest> {
  if (!path.isAbsolute(manifestPath)) {
    throw new DomainError({
      code: "invalid_path",
      message: `manifestPath must be an absolute path. Received: ${manifestPath}`,
    });
  }
  if (!(await fs.pathExists(manifestPath))) {
    throw new DomainError({
      code: "manifest_not_found",
      message: `manifest.yml not found at ${manifestPath}`,
    });
  }
  const content = await fs.readFile(manifestPath, "utf-8");
  const parsed = yaml.load(content) as Manifest | undefined;
  if (!parsed?.app?.id || !parsed.app.name) {
    throw new DomainError({
      code: "invalid_manifest",
      message: "manifest.yml must contain an 'app' section with id and name.",
    });
  }
  return parsed;
}

function findTemplatesDir(): string | null {
  const candidates = [
    path.join(__dirname, "..", "..", "templates"),
    path.join(__dirname, "..", "..", "..", "src", "templates"),
    path.join(__dirname, "..", "..", "..", "templates"),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

export function registerCreateComponentTool(server: McpServer): void {
  server.registerTool(
    "fireberry_apps_create_component",
    {
      title: "Add a Fireberry component to an existing app",
      description:
        "Scaffold a new Vite + React component inside an existing Fireberry app, install dependencies (@fireberry/ds and @fireberry/sdk), optionally build it, then register it in manifest.yml. The component name must be unique within the app. When this is the FIRST component of the app, this tool also registers the app with the Fireberry backend (the backend rejects zero-component apps, so registration is deferred from create_app to here).",
      inputSchema: {
        manifestPath: z
          .string()
          .min(1)
          .describe("Absolute path to the app's manifest.yml."),
        name: z
          .string()
          .min(1)
          .describe("Component name (also used as directory name)."),
        type: z
          .enum(COMPONENT_TYPES)
          .describe("Component type: record, global-menu, or side-menu."),
        settings: z
          .record(z.string(), z.unknown())
          .describe(
            "Type-specific settings: record requires { objectType, height }; global-menu requires { displayName }; side-menu requires { width }."
          ),
        skipBuild: z
          .boolean()
          .optional()
          .describe(
            "If true, skip the final `npm run build` step. The agent can run it later. Default: false."
          ),
      },
      outputSchema: {
        status: z.literal("success"),
        componentId: z.string(),
        componentDir: z.string(),
        manifestPath: z.string(),
        buildSkipped: z.boolean(),
        appRegistered: z
          .boolean()
          .describe(
            "True if this call registered the app with the Fireberry backend (happens when adding the first component). False for subsequent components, which the app was already registered for."
          ),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ manifestPath, name, type, settings, skipBuild }, extra) => {
      const log = makeLogger(extra.sendNotification as SendNotificationFn);
      try {
        const manifest = await loadManifest(manifestPath);
        const components = (manifest.components ?? []) as unknown as
          | UntypedManifestComponent[]
          | undefined;
        if (components?.some((c) => c.title === name)) {
          throw new DomainError({
            code: "component_exists",
            message: `Component with name "${name}" already exists in manifest.`,
          });
        }

        // The Fireberry backend rejects zero-component apps, so create_app does
        // not register. We register here when adding the first component, which
        // mirrors the CLI's create -> create-component -> registerApp ordering.
        const isFirstComponent = (components?.length ?? 0) === 0;

        const componentSettings = validateSettings(type, settings);

        const appDir = path.dirname(manifestPath);
        const sanitizedName = sanitizeComponentName(name);
        if (!sanitizedName) {
          throw new DomainError({
            code: "invalid_component_name",
            message: `Component name "${name}" is invalid after sanitization.`,
          });
        }
        const componentDir = path.join(appDir, name);
        if (await fs.pathExists(componentDir)) {
          throw new DomainError({
            code: "component_dir_exists",
            message: `Directory already exists: ${componentDir}`,
          });
        }

        await log.info("Creating Vite React app", { sanitizedName, appDir });
        const viteResult = await runPiped(
          "npm",
          ["create", "vite@latest", sanitizedName, "--", "--template", "react", "--no-interactive"],
          { cwd: appDir },
          (stream, line) => log.debug(`vite[${stream}]`, { line })
        );
        if (viteResult.exitCode !== 0) {
          throw new DomainError({
            code: "vite_scaffold_failed",
            message: `npm create vite failed (exit ${viteResult.exitCode}).`,
            details: { stderrTail: viteResult.stderrTail },
          });
        }

        const scaffoldDir = path.join(appDir, sanitizedName);
        if (scaffoldDir !== componentDir) {
          await fs.move(scaffoldDir, componentDir, { overwrite: false });
        }

        await log.info("Installing dependencies", { componentDir });
        const installResult = await runPiped(
          "npm",
          ["install"],
          { cwd: componentDir },
          (stream, line) => log.debug(`npm-install[${stream}]`, { line })
        );
        if (installResult.exitCode !== 0) {
          throw new DomainError({
            code: "npm_install_failed",
            message: `npm install failed (exit ${installResult.exitCode}).`,
            details: { stderrTail: installResult.stderrTail },
          });
        }

        await log.info("Installing Fireberry packages", {
          packages: ["@fireberry/ds", "@fireberry/sdk"],
        });
        const fbResult = await runPiped(
          "npm",
          ["install", "@fireberry/ds@latest", "@fireberry/sdk@latest"],
          { cwd: componentDir },
          (stream, line) => log.debug(`fireberry-install[${stream}]`, { line })
        );
        if (fbResult.exitCode !== 0) {
          throw new DomainError({
            code: "fireberry_install_failed",
            message: `Failed to install Fireberry packages (exit ${fbResult.exitCode}).`,
            details: { stderrTail: fbResult.stderrTail },
          });
        }

        const templatesDir = findTemplatesDir();
        if (templatesDir) {
          const templateFile =
            type === COMPONENT_TYPE.RECORD ? "App-record.jsx" : "App-other.jsx";
          const templatePath = path.join(templatesDir, templateFile);
          if (await fs.pathExists(templatePath)) {
            const tpl = await fs.readFile(templatePath, "utf-8");
            await fs.writeFile(
              path.join(componentDir, "src", "App.jsx"),
              tpl,
              "utf-8"
            );
            await log.info("Applied App.jsx template", { templateFile });
          } else {
            await log.warning("Template file missing, skipping", {
              templatePath,
            });
          }
        } else {
          await log.warning(
            "Templates directory not found; skipping App.jsx override"
          );
        }

        if (!skipBuild) {
          await log.info("Building component", { componentDir });
          const buildResult = await runPiped(
            "npm",
            ["run", "build"],
            { cwd: componentDir },
            (stream, line) => log.debug(`build[${stream}]`, { line })
          );
          if (buildResult.exitCode !== 0) {
            throw new DomainError({
              code: "build_failed",
              message: `npm run build failed (exit ${buildResult.exitCode}).`,
              details: { stderrTail: buildResult.stderrTail },
            });
          }
        } else {
          await log.info("Skipping build per request");
        }

        const componentId = uuidv4();
        const relativePath = path.relative(appDir, componentDir);
        const newComponent: UntypedManifestComponent = {
          type,
          title: name,
          id: componentId,
          path: path.join(relativePath, "dist"),
          settings: componentSettings,
        };

        const nextManifest = {
          ...manifest,
          components: [
            ...((manifest.components as unknown as UntypedManifestComponent[]) ??
              []),
            newComponent,
          ],
        } as unknown as Manifest;

        // Register the app with Fireberry when adding the first component. The
        // backend rejects zero-component apps, so create_app defers registration
        // to here (mirrors the CLI's create -> create-component -> registerApp).
        // We register BEFORE persisting the manifest: if registration fails we
        // roll back the freshly built component directory and leave the manifest
        // untouched, so a retry starts from a clean slate.
        let appRegistered = false;
        if (isFirstComponent) {
          await log.info("Registering app with Fireberry (first component)", {
            appId: manifest.app.id,
            appName: manifest.app.name,
          });
          try {
            await createApp(nextManifest);
            appRegistered = true;
            await log.info("App registered with Fireberry");
          } catch (registrationErr) {
            let rolledBack = false;
            try {
              await fs.remove(componentDir);
              rolledBack = true;
            } catch {
              rolledBack = false;
            }
            return toErrorResult(registrationErr, {
              componentCreated: false,
              appRegistered: false,
              rolledBack,
              recovery:
                "The component build was rolled back because registering the app with Fireberry failed (the backend requires the app's first registration to succeed). Resolve the underlying cause (see code/hint - e.g. connectivity or auth), then re-run fireberry_apps_create_component.",
              ...(rolledBack ? {} : { leftoverDir: componentDir }),
            });
          }
        }

        await fs.writeFile(
          manifestPath,
          yaml.dump(nextManifest, {
            indent: 2,
            lineWidth: -1,
            noRefs: true,
          }),
          "utf-8"
        );

        await log.info("Component added to manifest", {
          componentId,
          manifestPath,
        });

        return toSuccessResult({
          componentId,
          componentDir,
          manifestPath,
          buildSkipped: Boolean(skipBuild),
          appRegistered,
        });
      } catch (err) {
        return toErrorResult(err);
      }
    }
  );
}
