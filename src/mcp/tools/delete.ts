import { z } from "zod";
import path from "node:path";
import fs from "fs-extra";
import yaml from "js-yaml";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { deleteApp } from "../../api/requests.js";
import type { Manifest } from "../../api/types.js";
import { DomainError, toErrorResult, toSuccessResult } from "../lib/mcp-errors.js";

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

export function registerDeleteTool(server: McpServer): void {
  server.registerTool(
    "fireberry_apps_delete_app",
    {
      title: "Delete Fireberry app",
      description:
        "Delete a Fireberry app from the platform using the active profile. REQUIRES confirm:true. Cannot be undone.",
      inputSchema: {
        manifestPath: z
          .string()
          .min(1)
          .describe("Absolute path to the app's manifest.yml."),
        confirm: z
          .boolean()
          .describe(
            "MUST be set to true to actually delete. When false or missing, the tool returns the app metadata that would be deleted and does nothing."
          ),
      },
      outputSchema: {
        status: z.literal("success"),
        appId: z.string(),
        appName: z.string(),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ manifestPath, confirm }) => {
      try {
        const manifest = await loadManifest(manifestPath);
        if (confirm !== true) {
          throw new DomainError({
            code: "confirmation_required",
            message: `Deletion not confirmed. Pass confirm:true to delete app "${manifest.app.name}" (${manifest.app.id}). This action cannot be undone.`,
            hint: "Re-call this tool with confirm:true once the human user has approved deletion.",
            details: {
              appId: manifest.app.id,
              appName: manifest.app.name,
            },
          });
        }

        await deleteApp(manifest);

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
