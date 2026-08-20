import { z } from "zod";
import { AppError } from "./errors";
import { log } from "./log";
import type { ActionResult } from "./errors";

export function fieldErrorsFrom(error: z.ZodError): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    result[key] = [...(result[key] ?? []), issue.message];
  }
  return result;
}

export function parseForm<T extends z.ZodTypeAny>(
  schema: T,
  formData: FormData,
): { ok: true; data: z.infer<T> } | { ok: false; result: ActionResult<never> } {
  const raw: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (value instanceof File) {
      if (value.size > 0) raw[key] = value;
      continue;
    }
    const existing = raw[key];
    if (existing === undefined) raw[key] = value;
    else if (Array.isArray(existing)) existing.push(value);
    else raw[key] = [existing, value];
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      result: {
        ok: false,
        error: "Some fields need attention before this can be saved.",
        fieldErrors: fieldErrorsFrom(parsed.error),
      },
    };
  }
  return { ok: true, data: parsed.data };
}

export function toActionError(error: unknown, event: string): ActionResult<never> {
  if (error instanceof AppError) {
    return { ok: false, error: error.message };
  }
  log.error(event, { error });
  return { ok: false, error: "Something on our side failed. Your work is saved. Try again in a moment." };
}

export function formList(formData: FormData, key: string): string[] {
  return formData
    .getAll(key)
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function optionalText(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function optionalInt(formData: FormData, key: string): number | null {
  const value = optionalText(formData, key);
  if (value === null) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function checkboxValue(formData: FormData, key: string): boolean {
  const value = formData.get(key);
  return value === "on" || value === "true" || value === "1";
}
