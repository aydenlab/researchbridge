const ZONE = "UTC";

const DATE = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "long", day: "numeric", timeZone: ZONE });
const SHORT_DATE = new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric", year: "numeric", timeZone: ZONE });
const MONTH = new Intl.DateTimeFormat("en-CA", { month: "short", year: "numeric", timeZone: ZONE });

export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "Not set";
  const date = typeof value === "string" ? parseDateOnly(value) : value;
  if (!date || Number.isNaN(date.getTime())) return "Not set";
  return DATE.format(date);
}

export function formatShortDate(value: Date | string | null | undefined): string {
  if (!value) return "Not set";
  const date = typeof value === "string" ? parseDateOnly(value) : value;
  if (!date || Number.isNaN(date.getTime())) return "Not set";
  return SHORT_DATE.format(date);
}

export function formatMonth(value: Date | string | null | undefined): string {
  if (!value) return "Present";
  const date = typeof value === "string" ? parseDateOnly(value) : value;
  if (!date || Number.isNaN(date.getTime())) return "Present";
  return MONTH.format(date);
}

export function parseDateOnly(value: string): Date | null {
  if (!value) return null;
  const iso = value.length === 10 ? `${value}T12:00:00Z` : value;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function relativeDays(value: Date | string | null | undefined): number | null {
  if (!value) return null;
  const date = typeof value === "string" ? parseDateOnly(value) : value;
  if (!date) return null;
  const diff = date.getTime() - Date.now();
  return Math.ceil(diff / (24 * 60 * 60 * 1000));
}

export function deadlineNote(value: string | null | undefined): { text: string; urgent: boolean } {
  const days = relativeDays(value);
  if (days === null) return { text: "No deadline set", urgent: false };
  if (days < 0) return { text: "Deadline passed", urgent: false };
  if (days === 0) return { text: "Closes today", urgent: true };
  if (days === 1) return { text: "Closes tomorrow", urgent: true };
  if (days <= 7) return { text: `Closes in ${days} days`, urgent: true };
  return { text: `Closes ${formatShortDate(value)}`, urgent: false };
}

export function hoursLabel(min: number | null, max: number | null): string {
  if (min === null && max === null) return "Hours to be discussed";
  if (min !== null && max !== null) {
    return min === max ? `${min} hours per week` : `${min} to ${max} hours per week`;
  }
  if (min !== null) return `${min}+ hours per week`;
  return `Up to ${max} hours per week`;
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 72);
}

export function initials(name: string | null | undefined): string {
  if (!name) return "RB";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "RB";
}

export function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1).trimEnd()}...`;
}

export function pluralize(count: number, singular: string, plural?: string): string {
  return count === 1 ? singular : (plural ?? `${singular}s`);
}

export function percent(value: number | null): string {
  if (value === null) return "Not available";
  return `${Math.round(value)} percent`;
}
