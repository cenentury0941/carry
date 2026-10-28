import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: { service: "carry" },
});

export function childLog(requestId: string, extra?: Record<string, unknown>) {
  return logger.child({ requestId, ...extra });
}
