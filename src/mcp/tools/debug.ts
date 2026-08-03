import { z } from "zod";
import path from "node:path";
import fs from "fs-extra";
import yaml from "js-yaml";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { updateDebug } from "../../api/requests.js";
import type { Manifest, ManifestComponent } from "../../api/types.js";
import { DomainError, toErrorResult, toSuccessResult } from "../lib/mcp-errors.js";

const LOCALHOST_URL = /^localhost:\d+$/;

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

function findComponent(
  manifest: Manifest,
  componentId: string
): ManifestComponent {
  const components = manifest.components ?? [];
  const match = components.find(
    (c) => c.id.toLowerCase() === componentId.toLowerCase()
  );
  if (!match) {
    throw new DomainError({
      code: "component_not_found",
      message: `Component "${componentId}" not found in manifest.`,
      details: {
        availableComponents: components.map((c) => ({
          id: c.id,
          title: c.title,
        })),
      },
    });
  }
  return match;
}

function registerDebugStartTool(server: McpServer) {
  server.registerTool(
    "fireberry_apps_debug_start",
    {
      title: "Start debugging a component",
      description:
        "Point a Fireberry component at a local development URL (must be localhost:<port>). Until stopped, the platform will render the component from this URL.",
      inputSchema: {
        manifestPath: z
          .string()
          .min(1)
          .describe("Absolute path to the app's manifest.yml."),
        componentId: z
          .string()
          .min(1)
          .describe("UUID of the component to debug."),
        url: z
          .string()
          .regex(LOCALHOST_URL, "URL must be in the form localhost:<port> (no scheme).")
          .describe('Localhost URL like "localhost:5173".'),
      },
      outputSchema: {
        status: z.literal("success"),
        componentId: z.string(),
        componentTitle: z.string(),
        url: z.string(),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ manifestPath, componentId, url }) => {
      try {
        const manifest = await loadManifest(manifestPath);
        const component = findComponent(manifest, componentId);
        await updateDebug(componentId, manifest, url);
        return toSuccessResult({
          componentId: component.id,
          componentTitle: component.title,
          url,
        });
      } catch (err) {
        return toErrorResult(err);
      }
    }
  );
}

function registerDebugStopTool(server: McpServer) {
  server.registerTool(
    "fireberry_apps_debug_stop",
    {
      title: "Stop debugging a component",
      description: "Disable debug routing for a Fireberry component.",
      inputSchema: {
        manifestPath: z
          .string()
          .min(1)
          .describe("Absolute path to the app's manifest.yml."),
        componentId: z
          .string()
          .min(1)
          .describe("UUID of the component to stop debugging."),
      },
      outputSchema: {
        status: z.literal("success"),
        componentId: z.string(),
        componentTitle: z.string(),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ manifestPath, componentId }) => {
      try {
        const manifest = await loadManifest(manifestPath);
        const component = findComponent(manifest, componentId);
        await updateDebug(componentId, manifest);
        return toSuccessResult({
          componentId: component.id,
          componentTitle: component.title,
        });
      } catch (err) {
        return toErrorResult(err);
      }
    }
  );
}

export function registerDebugTools(server: McpServer): void {
  registerDebugStartTool(server);
  registerDebugStopTool(server);
}
