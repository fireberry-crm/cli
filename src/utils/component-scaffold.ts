import { COMPONENT_TYPE, ComponentType } from "../constants/component-types.js";

export const DEFAULT_ICON_NAME = "related-single";

export const DEFAULT_ICON_COLOR = "#7aae7f";

export function sanitizeComponentName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function selectAppTemplateFile(type: ComponentType): string {
  return type === COMPONENT_TYPE.RECORD ? "App-record.jsx" : "App-other.jsx";
}
