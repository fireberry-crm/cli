export interface CreateAppRequest {
  appId: string;
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

export interface ManifestComponent {
  type: string;
  title: string;
  key: string;
  path: string;
  settings?: Record<string, unknown>;
}

export interface Manifest {
  app: ManifestApp;
  components?: ManifestComponent[];
}

export interface ZippedComponent {
  title: string;
  key: string;
  build: Buffer;
}
