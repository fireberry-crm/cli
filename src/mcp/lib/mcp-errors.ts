import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { ApiError } from "../../api/errors.js";

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

export interface ErrorPayload {
  status: "error";
  code: string;
  message: string;
  fatal: boolean;
  hint?: string;
  details?: Record<string, unknown>;
}

// Default guidance for fatal codes so an agent knows to stop a multi-step
// workflow instead of marching into dependent phases that cannot succeed.
const FATAL_HINTS: Record<string, string> = {
  backend_unavailable:
    "The Fireberry backend is unreachable. Stop this workflow and do not run dependent steps (push/install/debug). Retry only after a read-only tool such as fireberry_apps_whoami succeeds or the user confirms connectivity.",
  backend_error:
    "The Fireberry backend returned a server error. Stop this workflow and retry later; do not proceed to dependent steps.",
  auth_error:
    "Authentication failed. Ask the user to re-run `fireberry init` (optionally `--alias <name>`). Do not retry dependent steps until this is resolved.",
};

export function buildErrorPayload(err: unknown): ErrorPayload {
  if (err instanceof ApiError) {
    return {
      status: "error",
      code: err.code,
      message: err.message,
      fatal: err.fatal,
      hint: FATAL_HINTS[err.code],
      details: err.status !== undefined ? { httpStatus: err.status } : undefined,
    };
  }

  if (err instanceof DomainError) {
    return {
      status: "error",
      code: err.code,
      message: err.message,
      fatal: false,
      hint: err.hint ?? FATAL_HINTS[err.code],
      details: err.details,
    };
  }

  if (err instanceof Error) {
    return {
      status: "error",
      code: "internal_error",
      message: err.message,
      fatal: false,
    };
  }

  return {
    status: "error",
    code: "internal_error",
    message: typeof err === "string" ? err : "Unknown error",
    fatal: false,
  };
}

/**
 * Build a tool error result.
 *
 * IMPORTANT: we deliberately do NOT set `structuredContent`. Each tool registers
 * an `outputSchema` describing only its success shape; the MCP SDK validates
 * `structuredContent` against that schema and would reject the error shape,
 * masking the real error as an opaque `-32602`. Putting the payload only in
 * `content` text (with `isError: true`) lets the real code/message/hint reach
 * the client. See docs/mcp-error-output-testing-conclusions.md.
 */
export function toErrorResult(
  err: unknown,
  extraDetails?: Record<string, unknown>
): CallToolResult {
  const payload = buildErrorPayload(err);
  if (extraDetails) {
    payload.details = { ...(payload.details ?? {}), ...extraDetails };
  }
  // Strip undefined keys so the serialized JSON stays clean.
  const compact = Object.fromEntries(
    Object.entries(payload).filter(([, v]) => v !== undefined)
  );
  return {
    isError: true,
    content: [{ type: "text", text: JSON.stringify(compact) }],
  };
}

export function toSuccessResult<T extends object>(data: T): CallToolResult {
  const payload = { status: "success" as const, ...data };
  return {
    content: [{ type: "text", text: JSON.stringify(payload) }],
    structuredContent: payload as unknown as Record<string, unknown>,
  };
}
