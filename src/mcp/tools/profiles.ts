import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  getActiveProfile,
  listProfiles,
  switchProfile,
} from "../../profiles/store.js";
import { DomainError, toErrorResult, toSuccessResult } from "../lib/mcp-errors.js";

function registerWhoamiTool(server: McpServer) {
  server.registerTool(
    "fireberry_apps_whoami",
    {
      title: "Identify active Fireberry profile",
      description:
        "Return the active Fireberry profile alias (no token is ever returned).",
      inputSchema: {},
      outputSchema: {
        status: z.literal("success"),
        activeProfile: z.string(),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => {
      try {
        const activeProfile = await getActiveProfile();
        return toSuccessResult({ activeProfile });
      } catch (err) {
        return toErrorResult(err);
      }
    }
  );
}

function registerListProfilesTool(server: McpServer) {
  server.registerTool(
    "fireberry_apps_list_profiles",
    {
      title: "List Fireberry profiles",
      description:
        "List all configured Fireberry profile aliases and indicate which one is active. Tokens are never returned.",
      inputSchema: {},
      outputSchema: {
        status: z.literal("success"),
        profiles: z.array(z.string()),
        activeProfile: z.string(),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => {
      try {
        const summary = await listProfiles();
        return toSuccessResult(summary);
      } catch (err) {
        return toErrorResult(err);
      }
    }
  );
}

function registerSwitchProfileTool(server: McpServer) {
  server.registerTool(
    "fireberry_apps_switch_profile",
    {
      title: "Switch active Fireberry profile",
      description:
        "Switch the active Fireberry profile by alias. Fails if the alias does not exist in local config. The human developer adds aliases via `fireberry init --alias <name>` from the terminal.",
      inputSchema: {
        alias: z
          .string()
          .min(1)
          .describe("Existing profile alias to switch to."),
      },
      outputSchema: {
        status: z.literal("success"),
        activeProfile: z.string(),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ alias }) => {
      try {
        await switchProfile(alias);
        const activeProfile = await getActiveProfile();
        return toSuccessResult({ activeProfile });
      } catch (err) {
        if (err instanceof Error) {
          return toErrorResult(
            new DomainError({
              code: "profile_not_found",
              message: err.message,
              hint: "Use fireberry_apps_list_profiles to see configured aliases, or run `fireberry init --alias <name>` from a terminal to add a new one.",
            })
          );
        }
        return toErrorResult(err);
      }
    }
  );
}

export function registerProfileTools(server: McpServer): void {
  registerWhoamiTool(server);
  registerListProfilesTool(server);
  registerSwitchProfileTool(server);
}
