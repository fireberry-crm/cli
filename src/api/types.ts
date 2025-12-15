import { COMPONENT_TYPE } from "../constants/component-types.js";

export interface CreateAppRequest {
  appId: string;
  componentId: string;
}

export interface ApiError {
  message: string;
  code?: string;
  details?: any;
}

export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
}

interface ManifestApp {
  id: string;
  name: string;
  description?: string;
}

export interface RecordComponentSettings {
  iconName: string;
  iconColor: string;
  objectType: number;
}

export interface GlobalMenuComponentSettings {
  displayName: string;
}

export interface SideMenuComponentSettings {
  icon: string;
  width: "S" | "M" | "L";
}

export type ComponentSettings =
  | RecordComponentSettings
  | GlobalMenuComponentSettings
  | SideMenuComponentSettings;

export interface BaseManifestComponent {
  title: string;
  id: string;
  path: string;
}

export interface RecordComponent extends BaseManifestComponent {
  type: typeof COMPONENT_TYPE.RECORD;
  settings: RecordComponentSettings;
}

export interface GlobalMenuComponent extends BaseManifestComponent {
  type: typeof COMPONENT_TYPE.GLOBAL_MENU;
  settings: GlobalMenuComponentSettings;
}

export type ManifestComponent = RecordComponent | GlobalMenuComponent;

export interface UntypedManifestComponent {
  type: string;
  title: string;
  id: string;
  path: string;
  settings?: Record<string, unknown>;
}

export interface Manifest {
  app: ManifestApp;
  components?: ManifestComponent[];
}

export interface ZippedComponent {
  title: string;
  id: string;
  build: Buffer;
}
