import { z } from "zod";
import path from "node:path";
import fs from "fs-extra";
import yaml from "js-yaml";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { DomainError, toErrorResult, toSuccessResult } from "../lib/mcp-errors.js";
import type { Manifest } from "../../api/types.js";

const IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  ".turbo",
  ".cache",
  "out",
  ".vite",
]);

interface FoundManifest {
  path: string;
  app: { id: string; name: string };
}

async function readManifestSummary(
  manifestPath: string
): Promise<FoundManifest | null> {
  try {
    const content = await fs.readFile(manifestPath, "utf-8");
    const parsed = yaml.load(content) as Manifest | undefined;
    if (!parsed || !parsed.app || !parsed.app.id || !parsed.app.name) {
      return null;
    }
    return {
      path: manifestPath,
      app: { id: parsed.app.id, name: parsed.app.name },
    };
  } catch {
    return null;
  }
}

async function walkForManifests(
  dir: string,
  depth: number,
  maxDepth: number,
  out: FoundManifest[]
): Promise<void> {
  if (depth > maxDepth) return;

  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (entry.name.startsWith(".") && entry.name !== "." && entry.name !== "..") {
      if (entry.isDirectory() && IGNORED_DIRS.has(entry.name)) continue;
    }
    const full = path.join(dir, entry.name);

    if (entry.isFile() && entry.name === "manifest.yml") {
      const summary = await readManifestSummary(full);
      if (summary) {
        out.push(summary);
      }
      continue;
    }

    if (entry.isDirectory() && !IGNORED_DIRS.has(entry.name)) {
      await walkForManifests(full, depth + 1, maxDepth, out);
    }
  }
}

function registerFindManifestsTool(server: McpServer) {
  server.registerTool(
    "fireberry_apps_find_manifests",
    {
      title: "Discover Fireberry app manifests",
      description:
        "Recursively scan a directory for Fireberry app manifest.yml files. Ignores node_modules/.git/dist/build and similar. Returns an array of { path, app: { id, name } }. When 0 or >1 results are returned, ASK THE USER which app to act on.",
      inputSchema: {
        rootDir: z
          .string()
          .min(1)
          .describe("Absolute path to a directory to scan for Fireberry app manifests."),
        maxDepth: z
          .number()
          .int()
          .min(0)
          .max(10)
          .optional()
          .describe("Max recursion depth (default 6)."),
      },
      outputSchema: {
        status: z.literal("success"),
        manifests: z.array(
          z.object({
            path: z.string(),
            app: z.object({ id: z.string(), name: z.string() }),
          })
        ),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ rootDir, maxDepth }) => {
      try {
        if (!path.isAbsolute(rootDir)) {
          throw new DomainError({
            code: "invalid_path",
            message: `rootDir must be an absolute path. Received: ${rootDir}`,
          });
        }
        if (!(await fs.pathExists(rootDir))) {
          throw new DomainError({
            code: "path_not_found",
            message: `rootDir does not exist: ${rootDir}`,
          });
        }
        const stats = await fs.stat(rootDir);
        if (!stats.isDirectory()) {
          throw new DomainError({
            code: "not_a_directory",
            message: `rootDir is not a directory: ${rootDir}`,
          });
        }
        const found: FoundManifest[] = [];
        await walkForManifests(rootDir, 0, maxDepth ?? 6, found);
        return toSuccessResult({ manifests: found });
      } catch (err) {
        return toErrorResult(err);
      }
    }
  );
}

function registerGetManifestTool(server: McpServer) {
  server.registerTool(
    "fireberry_apps_get_manifest",
    {
      title: "Read a Fireberry manifest",
      description:
        "Read and parse a Fireberry app manifest.yml file as JSON. Read-only inspector.",
      inputSchema: {
        manifestPath: z
          .string()
          .min(1)
          .describe("Absolute path to manifest.yml."),
      },
      outputSchema: {
        status: z.literal("success"),
        manifest: z
          .object({
            app: z.object({
              id: z.string(),
              name: z.string(),
              description: z.string().optional(),
            }),
            components: z.array(z.unknown()).optional(),
          })
          .passthrough(),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ manifestPath }) => {
      try {
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
        const parsed = yaml.load(content) as Manifest;
        if (!parsed || !parsed.app) {
          throw new DomainError({
            code: "invalid_manifest",
            message: "manifest.yml must contain an 'app' section.",
          });
        }
        if (!parsed.app.id || !parsed.app.name) {
          throw new DomainError({
            code: "invalid_manifest",
            message:
              "manifest.yml app section must contain both 'id' and 'name' fields.",
          });
        }
        return toSuccessResult({
          manifest: parsed as unknown as Record<string, unknown>,
        });
      } catch (err) {
        return toErrorResult(err);
      }
    }
  );
}

function registerDescribeAppTool(server: McpServer) {
  server.registerTool(
    "fireberry_apps_describe_app",
    {
      title: "Describe a Fireberry app",
      description:
        "High-level inspection of a Fireberry app: returns app metadata and a compact component list (id, title, type, path, settings).",
      inputSchema: {
        manifestPath: z
          .string()
          .min(1)
          .describe("Absolute path to manifest.yml."),
      },
      outputSchema: {
        status: z.literal("success"),
        app: z.object({
          id: z.string(),
          name: z.string(),
          description: z.string().optional(),
        }),
        components: z.array(
          z.object({
            id: z.string(),
            title: z.string(),
            type: z.string(),
            path: z.string(),
            settings: z.record(z.string(), z.unknown()).optional(),
          })
        ),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ manifestPath }) => {
      try {
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
            message:
              "manifest.yml must contain an 'app' section with id and name.",
          });
        }
        const rawComponents = (parsed.components ?? []) as unknown as Array<{
          id: string;
          title: string;
          type: string;
          path: string;
          settings?: Record<string, unknown>;
        }>;
        const components = rawComponents.map((c) => ({
          id: c.id,
          title: c.title,
          type: c.type,
          path: c.path,
          settings: c.settings,
        }));
        return toSuccessResult({
          app: {
            id: parsed.app.id,
            name: parsed.app.name,
            description: parsed.app.description,
          },
          components,
        });
      } catch (err) {
        return toErrorResult(err);
      }
    }
  );
}

export function registerDiscoveryTools(server: McpServer): void {
  registerFindManifestsTool(server);
  registerGetManifestTool(server);
  registerDescribeAppTool(server);
}
