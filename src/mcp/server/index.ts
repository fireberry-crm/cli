import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import packageJson from "../../../package.json" with { type: "json" };
import { registerProfileTools } from "../tools/profiles.js";
import { registerDiscoveryTools } from "../tools/discovery.js";
import { registerCreateAppTool } from "../tools/create-app.js";
import { registerCreateComponentTool } from "../tools/create-component.js";
import { registerPushTool } from "../tools/push.js";
import { registerInstallTool } from "../tools/install.js";
import { registerDeleteTool } from "../tools/delete.js";
import { registerDebugTools } from "../tools/debug.js";

const SERVER_INSTRUCTIONS = `Developer-side MCP for building Fireberry platform apps.

Discovery: ALWAYS call fireberry_apps_find_manifests with a workspace root before any state-modifying tool. If 0 or >1 manifests are returned, ASK THE USER which app to act on - do not guess.

Auth: tokens are stored locally by the human via 'fireberry init [--alias <name>]'. The LLM never sees raw tokens. Use fireberry_apps_list_profiles to discover available environments and fireberry_apps_switch_profile to switch.

Each lifecycle tool takes an explicit manifestPath; the server has no implicit working directory.

Errors: a failed tool returns isError with a JSON text payload { status: "error", code, message, fatal, hint?, details? }. When fatal is true (codes backend_unavailable, backend_error, auth_error), HALT the current multi-step workflow - do not attempt dependent steps (e.g. push -> install -> debug). For auth_error, ask the user to re-run 'fireberry init'. Non-fatal errors (e.g. invalid_path, manifest_not_found, confirmation_required, component_not_found) are caller-fixable: correct the input and retry.`;

export function createServer(): McpServer {
  const server = new McpServer(
    {
      name: "fireberry-apps",
      title: "Fireberry Apps Developer MCP",
      version: packageJson.version,
    },
    {
      capabilities: {
        tools: { listChanged: true },
        logging: {},
      },
      instructions: SERVER_INSTRUCTIONS,
    }
  );

  registerProfileTools(server);
  registerDiscoveryTools(server);
  registerCreateAppTool(server);
  registerCreateComponentTool(server);
  registerPushTool(server);
  registerInstallTool(server);
  registerDeleteTool(server);
  registerDebugTools(server);

  return server;
}
