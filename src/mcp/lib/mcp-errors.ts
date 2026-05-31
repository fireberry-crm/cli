import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export interface DomainErrorPayload {
  code: string;
  message: string;
  hint?: string;
  details?: Record<string, unknown>;
}

export class DomainError extends Error {
  readonly code: string;
  readonly hint?: string;
  readonly details?: Record<string, unknown>;

  constructor(payload: DomainErrorPayload) {
    super(payload.message);
    this.name = "DomainError";
    this.code = payload.code;
    this.hint = payload.hint;
    this.details = payload.details;
  }
}

export function toErrorResult(err: unknown): CallToolResult {
  let payload: { status: "error"; code: string; message: string; hint?: string; details?: Record<string, unknown> };

  if (err instanceof DomainError) {
    payload = {
      status: "error",
      code: err.code,
      message: err.message,
      hint: err.hint,
      details: err.details,
    };
  } else if (err instanceof Error) {
    payload = {
      status: "error",
      code: "internal_error",
      message: err.message,
    };
  } else {
    payload = {
      status: "error",
      code: "internal_error",
      message: typeof err === "string" ? err : "Unknown error",
    };
  }

  return {
    isError: true,
    content: [{ type: "text", text: JSON.stringify(payload) }],
    structuredContent: payload,
  };
}

export function toSuccessResult<T extends object>(data: T): CallToolResult {
  const payload = { status: "success" as const, ...data };
  return {
    content: [{ type: "text", text: JSON.stringify(payload) }],
    structuredContent: payload as unknown as Record<string, unknown>,
  };
}
