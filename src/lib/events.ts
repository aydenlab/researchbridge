import { db, analyticsEvents, auditLogs } from "@/db";
import { log } from "./log";

export const EVENT_NAMES = [
  "waitlist_joined",
  "account_verified",
  "student_profile_completed",
  "researcher_profile_completed",
  "researcher_verified",
  "opportunity_created",
  "opportunity_published",
  "opportunity_viewed",
  "opportunity_saved",
  "application_started",
  "application_submitted",
  "application_reviewed",
  "researcher_contacted_student",
  "application_accepted",
  "placement_confirmed",
] as const;

export type EventName = (typeof EVENT_NAMES)[number];

type EventInput = {
  name: EventName;
  userId?: string | null;
  institutionId?: string | null;
  subjectType?: string;
  subjectId?: string;
  properties?: Record<string, unknown>;
};

export async function recordEvent(input: EventInput) {
  try {
    await db.insert(analyticsEvents).values({
      name: input.name,
      userId: input.userId ?? null,
      institutionId: input.institutionId ?? null,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      properties: input.properties ?? {},
    });
  } catch (error) {
    log.warn("analytics_event_failed", { name: input.name, error });
  }
}

type AuditInput = {
  actorId?: string | null;
  action: string;
  subjectType?: string;
  subjectId?: string;
  detail?: Record<string, unknown>;
  ip?: string;
};

export async function recordAudit(input: AuditInput) {
  try {
    await db.insert(auditLogs).values({
      actorId: input.actorId ?? null,
      action: input.action,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      detail: input.detail ?? {},
      ip: input.ip,
    });
  } catch (error) {
    log.warn("audit_log_failed", { action: input.action, error });
  }
}
