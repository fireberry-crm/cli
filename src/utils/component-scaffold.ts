export const DEFAULT_ICON_NAME = "related-single";

export const DEFAULT_ICON_COLOR = "#7aae7f";

export function sanitizeComponentName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const APP_TEMPLATE_FILE = "App.jsx";
