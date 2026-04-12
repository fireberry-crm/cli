import path from "node:path";
import fs from "fs-extra";

const VALID_ICON_EXTENSIONS = [".svg", ".png", ".jpg", ".jpeg"];
const MAX_ICON_SIZE_BYTES = 500 * 1024;

export const validateAndReadIcon = async (
  iconPath: string
): Promise<Buffer> => {
  const fullPath = path.resolve(iconPath);

  if (!(await fs.pathExists(fullPath))) {
    throw new Error(`Icon file not found: ${iconPath}`);
  }

  const ext = path.extname(fullPath).toLowerCase();
  if (!VALID_ICON_EXTENSIONS.includes(ext)) {
    throw new Error(
      `Icon must be one of: ${VALID_ICON_EXTENSIONS.join(", ")}. Got: ${ext}`
    );
  }

  const buffer = await fs.readFile(fullPath);
  if (buffer.length > MAX_ICON_SIZE_BYTES) {
    throw new Error(
      `Icon file size must not exceed 500KB. Got: ${(
        buffer.length / 1024
      ).toFixed(2)}KB`
    );
  }

  if (buffer.length === 0) {
    throw new Error("Icon file is empty");
  }

  return buffer;
};
