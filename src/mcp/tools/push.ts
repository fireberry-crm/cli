import { z } from "zod";
import path from "node:path";
import fs from "fs-extra";
import yaml from "js-yaml";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { pushComponents } from "../../api/requests.js";
import { handleComponents } from "../../utils/components.utils.js";
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

export function registerPushTool(server: McpServer): void {
  server.registerTool(
    "fireberry_apps_push_app",
    {
      title: "Push Fireberry app",
      description:
        "Validate manifest.yml, zip each component build, and upload to Fireberry using the active profile. Component paths in the manifest are resolved relative to the manifest's directory.",
      inputSchema: {
        manifestPath: z
          .string()
          .min(1)
          .describe("Absolute path to the app's manifest.yml."),
      },
      outputSchema: {
        status: z.literal("success"),
        pushedComponents: z.array(
          z.object({
            id: z.string(),
            title: z.string(),
            sizeKB: z.number(),
          })
        ),
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

        await log.info("Validating components and creating archives", {
          manifestPath,
          basePath,
        });

        const zipped = await handleComponents(manifest, basePath);

        await log.info("Uploading components to Fireberry", {
          count: zipped.length,
        });

        if (zipped.length > 0) {
          await pushComponents(manifest.app.id, zipped, manifest);
        }

        const pushedComponents = zipped.map((c) => ({
          id: c.id,
          title: c.title,
          sizeKB: Number((c.build.length / 1024).toFixed(2)),
        }));

        await log.info("Push complete", { count: pushedComponents.length });

        return toSuccessResult({ pushedComponents });
      } catch (err) {
        return toErrorResult(err);
      }
    }
  );
}
