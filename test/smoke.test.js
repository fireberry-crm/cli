import { execSync } from "child_process";

try {
  execSync("node ./dist/bin/fireberry.js --help", { stdio: "pipe" });
  process.exit(0);
} catch (error) {
  process.exit(1);
}
