type Level = "debug" | "info" | "warn" | "error";

type Fields = Record<string, unknown>;

const REDACTED = "[redacted]";
const SENSITIVE = /^(code|codeHash|token|tokenHash|password|secret|apiKey|authorization|resume|transcript|note|textAnswer)$/i;

function scrub(fields: Fields): Fields {
  const out: Fields = {};
  for (const [key, value] of Object.entries(fields)) {
    if (SENSITIVE.test(key)) {
      out[key] = REDACTED;
    } else if (typeof value === "string" && value.length > 300) {
      out[key] = `${value.slice(0, 300)}...`;
    } else if (value instanceof Error) {
      out[key] = { name: value.name, message: value.message };
    } else {
      out[key] = value;
    }
  }
  return out;
}

function emit(level: Level, event: string, fields: Fields = {}) {
  const line = JSON.stringify({ level, event, ts: new Date().toISOString(), ...scrub(fields) });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const log = {
  debug: (event: string, fields?: Fields) => {
    if (process.env.NODE_ENV !== "production") emit("debug", event, fields);
  },
  info: (event: string, fields?: Fields) => emit("info", event, fields),
  warn: (event: string, fields?: Fields) => emit("warn", event, fields),
  error: (event: string, fields?: Fields) => emit("error", event, fields),
};
