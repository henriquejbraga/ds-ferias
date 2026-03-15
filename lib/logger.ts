/**
 * Logging estruturado para APIs: erros e ações sensíveis (login, aprovação, export).
 * Saída em JSON para facilitar agregação e busca em produção.
 */

type LogLevel = "info" | "warn" | "error";

type LogPayload = Record<string, unknown> & {
  message: string;
  level?: LogLevel;
  timestamp?: string;
};

function log(level: LogLevel, message: string, context: Record<string, unknown> = {}) {
  const payload: LogPayload = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...context,
  };
  const line = JSON.stringify(payload);
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  info(message: string, context?: Record<string, unknown>) {
    log("info", message, context);
  },
  warn(message: string, context?: Record<string, unknown>) {
    log("warn", message, context);
  },
  error(message: string, context?: Record<string, unknown>) {
    log("error", message, context);
  },
};
