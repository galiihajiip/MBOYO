import "server-only";

/**
 * Structured JSON logging for apps/web's server runtime (BLOCK 28). Every
 * log line is one JSON object on one line (stdout) — the standard shape a
 * log aggregator (or, locally, `pnpm dev`'s terminal) can parse without a
 * custom grammar, satisfying "structured logs" as an actual machine-
 * readable contract rather than a formatted string.
 *
 * Deliberately no external logging library: `console.log(JSON.stringify(...))`
 * is sufficient for a single Node process with no log-shipping
 * infrastructure configured (see OBSERVABILITY.md) — matching this
 * codebase's repeated "no new infra dependency without an actual need"
 * posture (rate-limit.ts, evaluate_escalations, etc.).
 */

const SENSITIVE_KEY_PATTERN = /password|token|secret|key|authorization|cookie|dsn/i;
const REDACTED = "[redacted]";

/**
 * Recursively redacts any object key matching SENSITIVE_KEY_PATTERN, plus
 * unconditionally redacts a fixed denylist of field names this codebase
 * knows are sensitive even if they don't match the pattern (e.g. `email`,
 * which is PII but doesn't contain "secret"/"token"). Never throws — a
 * circular reference or exotic value degrades to "[unserializable]" for
 * that one field rather than crashing the log call itself.
 */
const PII_FIELD_NAMES = new Set(["email", "phone", "phonenumber", "address", "sha256hash", "perceptualhash"]);

function redactValue(key: string, value: unknown, seen: WeakSet<object>): unknown {
  const lowerKey = key.toLowerCase();
  if (SENSITIVE_KEY_PATTERN.test(lowerKey) || PII_FIELD_NAMES.has(lowerKey)) {
    return REDACTED;
  }

  if (value === null || typeof value !== "object") {
    return value;
  }

  if (seen.has(value)) {
    return "[circular]";
  }
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => redactValue(key, item, seen));
  }

  const output: Record<string, unknown> = {};
  for (const [childKey, childValue] of Object.entries(value)) {
    output[childKey] = redactValue(childKey, childValue, seen);
  }
  return output;
}

/** Redacts a top-level fields object — the public entry point every log call routes through. */
export function redactFields(fields: Record<string, unknown>): Record<string, unknown> {
  const seen = new WeakSet<object>();
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    try {
      output[key] = redactValue(key, value, seen);
    } catch {
      output[key] = "[unserializable]";
    }
  }
  return output;
}

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogFields {
  requestId?: string;
  [key: string]: unknown;
}

interface LogLine {
  timestamp: string;
  level: LogLevel;
  service: "apps/web";
  message: string;
  [key: string]: unknown;
}

/**
 * Never logs raw image bytes: no call site in this codebase should ever
 * pass a Buffer/Uint8Array/ArrayBuffer as a field value, so this strips any
 * such value defensively (rather than trusting every future call site to
 * remember not to), replacing it with its byte length only.
 */
function stripBinary(fields: Record<string, unknown>): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value instanceof ArrayBuffer) {
      output[key] = `[binary ${value.byteLength} bytes omitted]`;
    } else if (ArrayBuffer.isView(value)) {
      output[key] = `[binary ${value.byteLength} bytes omitted]`;
    } else {
      output[key] = value;
    }
  }
  return output;
}

function emit(level: LogLevel, message: string, fields: LogFields = {}): void {
  const line: LogLine = {
    timestamp: new Date().toISOString(),
    level,
    service: "apps/web",
    message,
    ...redactFields(stripBinary(fields)),
  };

  const serialized = JSON.stringify(line);
  if (level === "error") {
    console.error(serialized);
  } else if (level === "warn") {
    console.warn(serialized);
  } else {
    console.log(serialized);
  }
}

export const logger = {
  debug: (message: string, fields?: LogFields) => emit("debug", message, fields),
  info: (message: string, fields?: LogFields) => emit("info", message, fields),
  warn: (message: string, fields?: LogFields) => emit("warn", message, fields),
  error: (message: string, fields?: LogFields) => emit("error", message, fields),
};
