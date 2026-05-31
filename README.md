# @fireberry/cli

Fireberry CLI tool for managing your Fireberry application.

The package ships **two binaries**:

| Binary | Audience | Purpose |
| --- | --- | --- |
| `fireberry` | Human developers | Interactive CLI for creating, pushing, installing, and debugging Fireberry apps. |
| `fireberry-apps-mcp` | Coding agents (Cursor, Claude Desktop, etc.) | stdio MCP server exposing the same operations to LLM-driven workflows. |

> Note: this is **not** the same package as [`@fireberry/mcp-server`](https://www.npmjs.com/package/@fireberry/mcp-server) (bin `mcp-fireberry`). That server is for end-user CRM data access (records, schemas). This one is for *building* Fireberry apps. Both can be connected to your coding agent at the same time without conflicts.

## Installation

Install the package globally using npm:

```bash
npm install -g @fireberry/cli@latest
```

After installation, both `fireberry` and `fireberry-apps-mcp` will be available on your `PATH`.

## CLI usage

### Get help

```bash
fireberry --help
```

### Initialize credentials

Set up a single token (legacy single-profile flow, unchanged):

```bash
fireberry init <tokenid>
```

Or use **named profiles** for multi-environment workflows:

```bash
fireberry init --alias dev          # prompts for token, saves under "dev"
fireberry init --alias staging xyz  # passes the token inline
fireberry init --list               # show all profiles, mark the active one
fireberry init --use staging        # switch the active profile
```

Profiles are stored in your OS config directory (`envPaths("Fireberry CLI").config/config.json`). Tokens never leave that file.

> **Backward compatibility:** running `fireberry init <tokenid>` with no flags writes the same flat single-token shape it always did. Using `--alias` for the first time transparently migrates the existing token to a `default` profile and starts maintaining both the new and legacy keys side-by-side, so older CLI versions keep working.

### Available commands

| Command | Purpose |
| --- | --- |
| `fireberry init [tokenid]` | Store credentials (flags: `--alias`, `--list`, `--use`). |
| `fireberry create [name]` | Create a new Fireberry app with a starter component. |
| `fireberry create-component [name] [type]` | Add a component to an existing app. |
| `fireberry push` | Validate, zip, and upload components. |
| `fireberry install` | Install the app on the active Fireberry account. |
| `fireberry delete` | Delete the app from Fireberry (asks for confirmation). |
| `fireberry debug <component-id> [url]` | Point a component at a local dev server (`localhost:<port>`). |
| `--help`, `--version` | Standard. |

## Use from a coding agent (MCP)

`fireberry-apps-mcp` is a stdio MCP server that exposes Fireberry app-development operations to any MCP-compatible coding agent (Cursor, Claude Desktop, Continue, etc.). The LLM never sees raw tokens — it works with profile aliases stored locally by the human developer.

### Cursor / Claude Desktop config

Once `@fireberry/cli` is installed globally:

```json
{
  "mcpServers": {
    "fireberry-apps": {
      "command": "fireberry-apps-mcp"
    }
  }
}
```

Or run on demand without a global install:

```json
{
  "mcpServers": {
    "fireberry-apps": {
      "command": "npx",
      "args": ["-y", "-p", "@fireberry/cli", "fireberry-apps-mcp"]
    }
  }
}
```

### One-time setup (from the human terminal)

```bash
fireberry init --alias dev          # store a "dev" environment token
fireberry init --alias staging      # add more as needed
fireberry init --use dev            # set the active profile the MCP server will use
```

### Tool catalog

All tools are prefixed `fireberry_apps_*` so they don't collide with `@fireberry/mcp-server`'s CRM tools.

**Profile management** (tokens are never returned):

- `fireberry_apps_whoami` → active profile alias.
- `fireberry_apps_list_profiles` → all configured aliases + which is active.
- `fireberry_apps_switch_profile({ alias })` → change the active profile.

**Discovery / state inspection** (read-only):

- `fireberry_apps_find_manifests({ rootDir, maxDepth? })` → scan for `manifest.yml` files (ignores `node_modules`, `dist`, `build`, `.git`, etc.).
- `fireberry_apps_get_manifest({ manifestPath })` → parsed YAML.
- `fireberry_apps_describe_app({ manifestPath })` → compact app + component summary.

**App lifecycle** — each takes an explicit `manifestPath` (no implicit working directory):

- `fireberry_apps_create_app({ name, parentDir, description? })` → scaffold a fresh app directory and register it with Fireberry.
- `fireberry_apps_create_component({ manifestPath, name, type, settings, skipBuild? })` → scaffold a Vite + React component, install `@fireberry/ds` and `@fireberry/sdk`, optionally build, and append to manifest.
- `fireberry_apps_push_app({ manifestPath })` → validate, zip, upload.
- `fireberry_apps_install_app({ manifestPath })` → install on the active account.
- `fireberry_apps_delete_app({ manifestPath, confirm: true })` → **requires `confirm: true`**, otherwise returns a structured error describing what would be deleted.
- `fireberry_apps_debug_start({ manifestPath, componentId, url })` / `fireberry_apps_debug_stop({ manifestPath, componentId })` → route a component to/from `localhost:<port>`.

### Manifest-discovery recipe

The MCP server is fully stateless about the current working directory. The agent is responsible for locating the manifest and asking the user when ambiguous:

1. Call `fireberry_apps_find_manifests` with the workspace root.
2. If exactly one manifest is returned, use its `path` for all subsequent tools.
3. If zero are returned, ask the user where the app lives or offer to create one via `fireberry_apps_create_app`.
4. If more than one is returned, list them (`app.name` + `app.id`) and ask the user which one to act on.
5. Pass the chosen `manifestPath` into every lifecycle tool.

### Error contract

- Domain failures (bad input, missing manifest, API 4xx, required `confirm: true`) return `{ isError: true, content: [{ type: "text", text: "{...}" }], structuredContent: { status: "error", code, message, hint? } }` so the agent can recover.
- Internal/protocol failures bubble up as standard JSON-RPC errors.

## License

MIT
