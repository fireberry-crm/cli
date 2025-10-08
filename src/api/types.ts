export interface CreateAppRequest {
  appId: string;
}

export interface CreateAppResponse {}

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
