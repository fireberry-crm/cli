export type ApiErrorCode =
  | "backend_unavailable"
  | "backend_error"
  | "auth_error"
  | "backend_request_error";

export interface ApiErrorParams {
  code: ApiErrorCode;
  message: string;
  fatal: boolean;
  status?: number;
}

/**
 * Transport/HTTP-level error raised by the Fireberry API client.
 *
 * `fatal: true` means a dependent multi-step workflow (e.g. create -> push ->
 * install -> debug) should halt rather than attempt later phases that cannot
 * succeed (backend down, 5xx, or auth failure).
 *
 * This class lives in the API layer (no MCP/UI dependency) so both the CLI and
 * the MCP server can consume it.
 */
export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly fatal: boolean;
  readonly status?: number;

  constructor({ code, message, fatal, status }: ApiErrorParams) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.fatal = fatal;
    this.status = status;
  }
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError;
}
