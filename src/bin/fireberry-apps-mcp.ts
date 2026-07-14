#!/usr/bin/env node
import "../config/env.js";
import { runStdioServer } from "../mcp/transports/stdio.js";

runStdioServer().catch((err: unknown) => {
  const message =
    err instanceof Error ? err.stack || err.message : String(err);
  console.error(`[fireberry-apps-mcp] fatal: ${message}`);
  process.exit(1);
});
