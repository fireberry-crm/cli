// Basic smoke test to verify the package can be loaded
import { execSync } from "child_process";

try {
  // Try to run the CLI with --help to verify it loads
  execSync("node ./dist/bin/fireberry.js --help", { stdio: "pipe" });
  console.log("Smoke test passed: CLI loads successfully");
  process.exit(0);
} catch (error) {
  console.error("Smoke test failed:", error.message);
  process.exit(1);
}
