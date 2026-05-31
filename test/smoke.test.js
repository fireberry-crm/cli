import { execSync, spawn } from "node:child_process";
import { once } from "node:events";

function fail(message, detail) {
  console.error(`[smoke] FAIL: ${message}`);
  if (detail !== undefined) {
    console.error(detail);
  }
  process.exit(1);
}

function pass(message) {
  console.log(`[smoke] OK: ${message}`);
}

try {
  execSync("node ./dist/bin/fireberry.js --help", { stdio: "pipe" });
  pass("fireberry --help");
} catch (error) {
  fail("fireberry --help exited non-zero", error?.stderr?.toString());
}

async function runMcpSmoke() {
  const child = spawn("node", ["./dist/bin/fireberry-apps-mcp.js"], {
    stdio: ["pipe", "pipe", "pipe"],
  });

  let stdoutBuf = "";
  const stdoutLines = [];
  const violations = [];

  child.stdout.setEncoding("utf-8");
  child.stdout.on("data", (chunk) => {
    stdoutBuf += chunk;
    let idx;
    while ((idx = stdoutBuf.indexOf("\n")) >= 0) {
      const line = stdoutBuf.slice(0, idx).replace(/\r$/, "");
      stdoutBuf = stdoutBuf.slice(idx + 1);
      if (!line.trim()) continue;
      stdoutLines.push(line);
      try {
        const parsed = JSON.parse(line);
        if (parsed.jsonrpc !== "2.0") {
          violations.push(`Non-JSON-RPC line: ${line}`);
        }
      } catch (e) {
        violations.push(`Stdout line is not valid JSON: ${line}`);
      }
    }
  });

  let stderrBuf = "";
  child.stderr.setEncoding("utf-8");
  child.stderr.on("data", (chunk) => {
    stderrBuf += chunk;
  });

  const exitPromise = once(child, "exit");

  const initialize = {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "smoke-test", version: "0.0.0" },
    },
  };
  child.stdin.write(JSON.stringify(initialize) + "\n");

  const initializedNotification = {
    jsonrpc: "2.0",
    method: "notifications/initialized",
  };
  child.stdin.write(JSON.stringify(initializedNotification) + "\n");

  const toolsList = {
    jsonrpc: "2.0",
    id: 2,
    method: "tools/list",
  };
  child.stdin.write(JSON.stringify(toolsList) + "\n");

  const whoami = {
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: { name: "fireberry_apps_whoami", arguments: {} },
  };
  child.stdin.write(JSON.stringify(whoami) + "\n");

  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    const haveInit = stdoutLines.some((l) => {
      try {
        const o = JSON.parse(l);
        return o.id === 1 && (o.result || o.error);
      } catch {
        return false;
      }
    });
    const haveTools = stdoutLines.some((l) => {
      try {
        const o = JSON.parse(l);
        return o.id === 2 && (o.result || o.error);
      } catch {
        return false;
      }
    });
    const haveWhoami = stdoutLines.some((l) => {
      try {
        const o = JSON.parse(l);
        return o.id === 3 && (o.result || o.error);
      } catch {
        return false;
      }
    });
    if (haveInit && haveTools && haveWhoami) break;
    await new Promise((r) => setTimeout(r, 50));
  }

  child.stdin.end();
  child.kill();
  await Promise.race([
    exitPromise,
    new Promise((resolve) => setTimeout(resolve, 1500)),
  ]);

  if (violations.length > 0) {
    fail(
      "fireberry-apps-mcp produced non-JSON-RPC stdout lines",
      violations.join("\n")
    );
  }

  const toolsListResponse = stdoutLines
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return null;
      }
    })
    .find((o) => o && o.id === 2 && o.result);

  if (!toolsListResponse) {
    fail(
      "fireberry-apps-mcp did not respond to tools/list within 10s",
      stderrBuf
    );
  }

  const toolNames = (toolsListResponse.result.tools || []).map((t) => t.name);
  const expected = [
    "fireberry_apps_whoami",
    "fireberry_apps_list_profiles",
    "fireberry_apps_switch_profile",
    "fireberry_apps_find_manifests",
    "fireberry_apps_get_manifest",
    "fireberry_apps_describe_app",
    "fireberry_apps_create_app",
    "fireberry_apps_create_component",
    "fireberry_apps_push_app",
    "fireberry_apps_install_app",
    "fireberry_apps_delete_app",
    "fireberry_apps_debug_start",
    "fireberry_apps_debug_stop",
  ];
  for (const name of expected) {
    if (!toolNames.includes(name)) {
      fail(`Expected tool not registered: ${name}`, toolNames.join("\n"));
    }
  }

  const whoamiResponse = stdoutLines
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return null;
      }
    })
    .find((o) => o && o.id === 3 && o.result);
  if (!whoamiResponse) {
    fail("fireberry-apps-mcp did not respond to whoami", stderrBuf);
  }

  pass(`fireberry-apps-mcp stdio hygiene + ${expected.length} tools registered`);
}

try {
  await runMcpSmoke();
  process.exit(0);
} catch (error) {
  fail("Unexpected smoke test error", error?.stack || String(error));
}
