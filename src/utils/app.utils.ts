import path from "node:path";
import fs from "fs-extra";
import chalk from "chalk";

const VALID_ICON_EXTENSIONS = [".svg", ".png", ".jpg", ".jpeg"];
const MAX_ICON_SIZE_BYTES = 500 * 1024;

export const validateAndReadIcon = async (iconPath: string): Promise<Buffer> => {
  const fullPath = path.join(process.cwd(), iconPath);

  if (!(await fs.pathExists(fullPath))) {
    throw new Error(`Icon file not found: ${chalk.yellow(iconPath)}`);
  }

  const ext = path.extname(fullPath).toLowerCase();
  if (!VALID_ICON_EXTENSIONS.includes(ext)) {
    throw new Error(
      `Icon must be one of: ${VALID_ICON_EXTENSIONS.join(", ")}. Got: ${ext}`
    );
  }

  const stats = await fs.stat(fullPath);
  if (stats.size > MAX_ICON_SIZE_BYTES) {
    throw new Error(
      `Icon file size must not exceed 500KB. Got: ${(stats.size / 1024).toFixed(2)}KB`
    );
  }

  return fs.readFile(fullPath);
};
