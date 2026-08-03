import { z } from "zod";
import path from "node:path";
import fs from "fs-extra";
import yaml from "js-yaml";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { installApp } from "../../api/requests.js";
import { validateManifestComponents } from "../../utils/components.utils.js";
import type { Manifest } from "../../api/types.js";
import { DomainError, toErrorResult, toSuccessResult } from "../lib/mcp-errors.js";
import { makeLogger, type SendNotificationFn } from "../lib/logging.js";

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

export function registerInstallTool(server: McpServer): void {
  server.registerTool(
    "fireberry_apps_install_app",
    {
      title: "Install Fireberry app on active account",
      description:
        "Install the Fireberry app described by manifest.yml on the account associated with the active profile.",
      inputSchema: {
        manifestPath: z
          .string()
          .min(1)
          .describe("Absolute path to the app's manifest.yml."),
      },
      outputSchema: {
        status: z.literal("success"),
        appId: z.string(),
        appName: z.string(),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ manifestPath }, extra) => {
      const log = makeLogger(extra.sendNotification as SendNotificationFn);
      try {
        const manifest = await loadManifest(manifestPath);
        const basePath = path.dirname(manifestPath);

        await log.info("Validating manifest components", { manifestPath });
        await validateManifestComponents(manifest, basePath);

        await log.info("Installing app on Fireberry", {
          appId: manifest.app.id,
          appName: manifest.app.name,
        });

        await installApp(manifest);

        return toSuccessResult({
          appId: manifest.app.id,
          appName: manifest.app.name,
        });
      } catch (err) {
        return toErrorResult(err);
      }
    }
  );
}
