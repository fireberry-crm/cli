export const COMPONENT_TYPE = {
  RECORD: "record",
  GLOBAL_MENU: "global-menu",
} as const;

export type ComponentType = (typeof COMPONENT_TYPE)[keyof typeof COMPONENT_TYPE];
