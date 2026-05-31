import type {
  ServerNotification,
  LoggingMessageNotification,
} from "@modelcontextprotocol/sdk/types.js";

type LoggingLevel = LoggingMessageNotification["params"]["level"];

export type SendNotificationFn = (
  notification: ServerNotification
) => Promise<void>;

const LOGGER_NAME = "fireberry-apps";

export async function logToClient(
  sendNotification: SendNotificationFn | undefined,
  level: LoggingLevel,
  message: string,
  data?: Record<string, unknown>
): Promise<void> {
  if (!sendNotification) return;
  const payload: Record<string, unknown> = { message };
  if (data) {
    Object.assign(payload, data);
  }
  try {
    await sendNotification({
      method: "notifications/message",
      params: {
        level,
        logger: LOGGER_NAME,
        data: payload,
      },
    });
  } catch {
    // never let logging break a tool call
  }
}

export function makeLogger(sendNotification: SendNotificationFn | undefined) {
  return {
    debug: (msg: string, data?: Record<string, unknown>) =>
      logToClient(sendNotification, "debug", msg, data),
    info: (msg: string, data?: Record<string, unknown>) =>
      logToClient(sendNotification, "info", msg, data),
    notice: (msg: string, data?: Record<string, unknown>) =>
      logToClient(sendNotification, "notice", msg, data),
    warning: (msg: string, data?: Record<string, unknown>) =>
      logToClient(sendNotification, "warning", msg, data),
    error: (msg: string, data?: Record<string, unknown>) =>
      logToClient(sendNotification, "error", msg, data),
  };
}

export type ToolLogger = ReturnType<typeof makeLogger>;
