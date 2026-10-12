// Bakes the Fireberry API URL into src/config/build-config.json at build time.
// Runs as part of `prebuild`, so it applies to `npm run build`, `npm publish`
// (via `prepare`) and `npm install <git-url>` (also via `prepare`).
//
// Usage: FIREBERRY_API_URL=https://dev.fireberry.com/api/v3 npm run build
// With no env var, the value is left empty and the CLI falls back to the
// version-based default at runtime (see src/api/axios.ts).
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = path.join(root, "src", "config", "build-config.json");
const apiUrl = (process.env.FIREBERRY_API_URL ?? "").trim();

writeFileSync(target, JSON.stringify({ apiUrl }, null, 2) + "\n");

if (apiUrl) {
  console.log(`[build-config] API URL baked into build: ${apiUrl}`);
} else {
  console.log("[build-config] No FIREBERRY_API_URL set; using runtime default");
}
