import { z } from "zod";
import path from "node:path";
import fs from "fs-extra";
import yaml from "js-yaml";
import { v4 as uuidv4 } from "uuid";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Manifest } from "../../api/types.js";
import { DomainError, toErrorResult, toSuccessResult } from "../lib/mcp-errors.js";

const APP_NAME_PATTERN = /^[a-zA-Z0-9_-]+$/;

export function registerCreateAppTool(server: McpServer): void {
  server.registerTool(
    "fireberry_apps_create_app",
    {
      title: "Create Fireberry app scaffold",
      description:
        "Scaffold a new Fireberry app directory containing only a fresh manifest.yml (no components). This is a LOCAL-ONLY step: it does NOT register the app with Fireberry, because the backend rejects apps with zero components. Registration happens automatically when you add the first component via fireberry_apps_create_component. Typical flow: create_app -> create_component -> push_app.",
      inputSchema: {
        name: z
          .string()
          .min(1)
          .describe(
            "App name (alphanumeric, underscores, hyphens). Used as the directory name and registered with Fireberry."
          ),
        parentDir: z
          .string()
          .min(1)
          .describe(
            "Absolute path to the parent directory in which the new app folder will be created."
          ),
        description: z
          .string()
          .optional()
          .describe("Optional description stored on app.description."),
      },
      outputSchema: {
        status: z.literal("success"),
        manifestPath: z.string(),
        appDir: z.string(),
        appId: z.string(),
        registered: z
          .boolean()
          .describe(
            "Always false here: the app is registered with Fireberry only after its first component is added."
          ),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ name, parentDir, description }) => {
      try {
        if (!APP_NAME_PATTERN.test(name)) {
          throw new DomainError({
            code: "invalid_app_name",
            message: `Invalid app name: "${name}". Only alphanumeric characters, underscores, and hyphens are allowed.`,
          });
        }
        if (!path.isAbsolute(parentDir)) {
          throw new DomainError({
            code: "invalid_path",
            message: `parentDir must be an absolute path. Received: ${parentDir}`,
          });
        }
        if (!(await fs.pathExists(parentDir))) {
          throw new DomainError({
            code: "path_not_found",
            message: `parentDir does not exist: ${parentDir}`,
          });
        }

        const appDir = path.resolve(parentDir, name);
        if (await fs.pathExists(appDir)) {
          throw new DomainError({
            code: "app_dir_exists",
            message: `Target directory already exists: ${appDir}`,
            hint: "Choose a different name or remove the existing directory.",
          });
        }

        await fs.ensureDir(appDir);

        const appId = uuidv4();
        const initialManifest: Manifest = {
          app: {
            id: appId,
            name,
            description: description ?? "",
          },
          components: [],
        };

        const manifestPath = path.join(appDir, "manifest.yml");
        await fs.writeFile(
          manifestPath,
          yaml.dump(initialManifest, {
            indent: 2,
            lineWidth: -1,
            noRefs: true,
          }),
          "utf-8"
        );

        // Intentionally NO backend registration here. The Fireberry backend
        // rejects apps with zero components; registration is deferred to the
        // first fireberry_apps_create_component call (mirrors the CLI's
        // create -> create-component -> registerApp ordering).
        return toSuccessResult({
          manifestPath,
          appDir,
          appId,
          registered: false,
        });
      } catch (err) {
        return toErrorResult(err);
      }
    }
  );
}
