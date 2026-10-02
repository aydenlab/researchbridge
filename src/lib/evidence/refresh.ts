import { and, asc, eq, inArray, isNotNull, ne, or, sql } from "drizzle-orm";
import { db, researchExperiences, storedFiles, studentEvidence, studentProfiles } from "@/db";
import { analyzeResume, resumeInputHash } from "@/lib/ai/resume-analysis";
import { log } from "@/lib/log";
import { listSkills } from "@/lib/queries/taxonomy";
import { storage } from "@/lib/storage";
import {
  combineResearchCount,
  countPublications,
  experienceText,
  readResumeText,
  toDocumented,
  type DocumentedEvidence,
  type DocumentedPublication,
  type DocumentedRole,
  type DocumentedSkill,
  type ResearchExperienceInput,
} from "./documented";

/** Bump when the reading logic changes, so every stored reading is redone. */
export const ANALYZER_VERSION = 1;

/** A failed model call is not retried for this long, so an outage is not hammered. */
const MODEL_RETRY_MS = 60 * 60 * 1000;
/** Longest resume text kept. A two-page CV is a few thousand characters. */
const MAX_RESUME_CHARS = 40_000;

/** Text from a stored PDF, or null when it cannot be read (a scan, or a missing file). */
export async function extractResumeText(fileId: string): Promise<string | null> {
  const [file] = await db
    .select({ storageKey: storedFiles.storageKey, contentType: storedFiles.contentType })
    .from(storedFiles)
    .where(eq(storedFiles.id, fileId))
    .limit(1);
  if (!file || file.contentType !== "application/pdf") return null;

  const body = await storage().get(file.storageKey);
  if (!body) return null;

  try {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(body));
    const { text } = await extractText(pdf, { mergePages: true });
    const clean = String(text ?? "")
      .replace(/\r/g, "")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
      .slice(0, MAX_RESUME_CHARS);
    return clean.length >= 40 ? clean : null;
  } catch (error) {
    log.warn("resume_text_unreadable", { fileId, error: String(error) });
    return null;
  }
}

function toExperienceInput(rows: (typeof researchExperiences.$inferSelect)[]): ResearchExperienceInput[] {
  return rows.map((row) => ({
    organization: row.organization,
    title: row.title,
    description: row.description,
    techniques: row.techniques ?? [],
    outputs: row.outputs ?? [],
  }));
}

/** Documented evidence for many students in a fixed handful of queries. */
export async function loadDocumentedEvidence(studentIds: string[]): Promise<Map<string, DocumentedEvidence>> {
  const result = new Map<string, DocumentedEvidence>();
  if (studentIds.length === 0) return result;
  const ids = [...new Set(studentIds)];
  const [rows, experiences] = await Promise.all([
    db.select().from(studentEvidence).where(inArray(studentEvidence.studentId, ids)),
    db
      .select()
      .from(researchExperiences)
      .where(inArray(researchExperiences.studentId, ids))
      .orderBy(asc(researchExperiences.sortOrder)),
  ]);
  const rowBy = new Map(rows.map((row) => [row.studentId, row]));
  const experiencesBy = new Map<string, (typeof researchExperiences.$inferSelect)[]>();
  for (const row of experiences) experiencesBy.set(row.studentId, [...(experiencesBy.get(row.studentId) ?? []), row]);
  for (const id of ids) {
    result.set(id, toDocumented(rowBy.get(id) ?? null, toExperienceInput(experiencesBy.get(id) ?? [])));
  }
  return result;
}

function mergeSkills(primary: DocumentedSkill[], secondary: DocumentedSkill[]): DocumentedSkill[] {
  const seen = new Set<string>();
  const merged: DocumentedSkill[] = [];
  for (const skill of [...primary, ...secondary]) {
    const key = skill.name.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(skill);
  }
  return merged.slice(0, 60);
}

export type RefreshOutcome = "unchanged" | "updated" | "no_profile";

/**
 * Reads one student's resume and research history and stores the result.
 *
 * The plain-text reading always runs; it is cheap and needs nothing external.
 * The model reading runs only when allowed, when there is readable resume text,
 * and when the resume or research entries have changed since the last
 * successful reading, so an unchanged profile is never paid for twice.
 */
export async function refreshStudentEvidence(
  studentId: string,
  options: { useModel?: boolean; force?: boolean } = {},
): Promise<{ outcome: RefreshOutcome; modelCalled: boolean; modelFailure?: string }> {
  const useModel = options.useModel ?? true;
  const [profile] = await db
    .select({ resumeFileId: studentProfiles.resumeFileId })
    .from(studentProfiles)
    .where(eq(studentProfiles.userId, studentId))
    .limit(1);
  if (!profile) return { outcome: "no_profile", modelCalled: false };

  const [existing] = await db.select().from(studentEvidence).where(eq(studentEvidence.studentId, studentId)).limit(1);
  const experienceRows = await db
    .select()
    .from(researchExperiences)
    .where(eq(researchExperiences.studentId, studentId))
    .orderBy(asc(researchExperiences.sortOrder));
  const experiences = toExperienceInput(experienceRows);
  const fromProfile = experienceText(experiences);

  // Re-extracting a PDF that has not changed is wasted work.
  const sameResume = existing && existing.resumeFileId === (profile.resumeFileId ?? null);
  const resumeText = !profile.resumeFileId
    ? null
    : sameResume && existing.resumeText !== null && !options.force
      ? existing.resumeText
      : await extractResumeText(profile.resumeFileId);

  const inputHash = resumeText ? resumeInputHash(resumeText, fromProfile) : null;
  const modelCurrent =
    existing?.source === "resume_ai" && existing.aiInputHash === inputHash && existing.analyzerVersion === ANALYZER_VERSION;
  if (modelCurrent && !options.force) return { outcome: "unchanged", modelCalled: false };

  const known = (await listSkills()).map((skill) => skill.name);
  const plain = readResumeText([resumeText ?? "", fromProfile].filter(Boolean).join("\n\n"), known);

  let skills: DocumentedSkill[] = plain.skills;
  let roles: DocumentedRole[] = resumeText ? readResumeText(resumeText, []).researchRoles : [];
  let publications: DocumentedPublication[] = plain.publications;
  let summary: string | null = null;
  let source: DocumentedEvidence["source"] = resumeText ? "resume_text" : "profile_only";
  let aiModel: string | null = null;
  let aiInputHash: string | null = null;
  let modelCalled = false;
  let modelFailure: string | undefined;

  const recentlyFailed =
    existing?.aiAttemptedAt && existing.source !== "resume_ai" && Date.now() - existing.aiAttemptedAt.getTime() < MODEL_RETRY_MS;
  if (useModel && resumeText && inputHash && (!recentlyFailed || options.force)) {
    modelCalled = true;
    const analysis = await analyzeResume({ studentId, resumeText, experienceText: fromProfile });
    if (analysis.ok) {
      skills = mergeSkills(
        analysis.analysis.skills.map((skill) => ({ name: skill.name, quote: skill.evidence })),
        plain.skills,
      );
      roles = analysis.analysis.researchRoles.map((role) => ({
        role: role.role,
        organization: role.organization,
        quote: role.evidence,
      }));
      publications = analysis.analysis.publications;
      summary = analysis.analysis.summary || null;
      source = "resume_ai";
      aiModel = analysis.model;
      aiInputHash = analysis.inputHash;
    } else {
      modelFailure = analysis.reason;
    }
  } else if (modelCurrent && existing) {
    // Forced plain refresh of a resume the model already read: keep its reading.
    skills = existing.skills;
    roles = existing.researchRoles;
    publications = existing.publications;
    summary = existing.summary;
    source = "resume_ai";
    aiModel = existing.aiModel;
    aiInputHash = existing.aiInputHash;
  }

  const counts = countPublications(publications);
  const values = {
    resumeFileId: profile.resumeFileId ?? null,
    resumeText,
    resumeReadable: Boolean(resumeText),
    skills,
    researchRoles: roles,
    researchCount: combineResearchCount(roles.length, experiences.length),
    publications,
    peerReviewedCount: counts.peerReviewedCount,
    presentationCount: counts.presentationCount,
    summary,
    source,
    analyzerVersion: ANALYZER_VERSION,
    aiModel,
    aiInputHash,
    aiAttemptedAt: modelCalled ? new Date() : (existing?.aiAttemptedAt ?? null),
    analyzedAt: new Date(),
  };

  await db
    .insert(studentEvidence)
    .values({ studentId, ...values })
    .onConflictDoUpdate({ target: studentEvidence.studentId, set: values });

  log.info("student_evidence_refreshed", { studentId, source, modelCalled, modelFailure, skills: skills.length });
  return { outcome: "updated", modelCalled, modelFailure };
}

/**
 * Students whose stored reading is missing or out of date: no row, a different
 * resume, an older reader, or a readable resume the model has not read yet.
 */
export async function staleEvidenceStudentIds(options: { includeModelPending: boolean; limit?: number }) {
  const conditions = [
    sql`${studentEvidence.studentId} is null`,
    sql`${studentEvidence.resumeFileId} is distinct from ${studentProfiles.resumeFileId}`,
    sql`${studentEvidence.analyzerVersion} < ${ANALYZER_VERSION}`,
  ];
  if (options.includeModelPending) {
    conditions.push(
      and(
        eq(studentEvidence.resumeReadable, true),
        ne(studentEvidence.source, "resume_ai"),
        or(
          sql`${studentEvidence.aiAttemptedAt} is null`,
          sql`${studentEvidence.aiAttemptedAt} < now() - interval '1 hour'`,
        ),
      )!,
    );
  }
  const rows = await db
    .select({ id: studentProfiles.userId })
    .from(studentProfiles)
    .leftJoin(studentEvidence, eq(studentEvidence.studentId, studentProfiles.userId))
    .where(or(...conditions))
    .limit(options.limit ?? 500);
  return rows.map((row) => row.id);
}

/**
 * Brings stale readings up to date. The model pass stops at the first sign of
 * throttling or an exhausted budget rather than queueing failures, and picks up
 * where it left off next time.
 */
export async function refreshStaleEvidence(options: { useModel: boolean; limit?: number }) {
  const ids = await staleEvidenceStudentIds({ includeModelPending: options.useModel, limit: options.limit });
  let updated = 0;
  let modelCalls = 0;
  let useModel = options.useModel;
  for (const id of ids) {
    const result = await refreshStudentEvidence(id, { useModel });
    if (result.outcome === "updated") updated += 1;
    if (result.modelCalled) modelCalls += 1;
    if (
      result.modelFailure &&
      ["throttled", "budget_exceeded", "provider_unavailable", "missing_api_key", "disabled", "invalid_api_key"].includes(
        result.modelFailure,
      )
    ) {
      useModel = false;
    }
  }
  return { candidates: ids.length, updated, modelCalls };
}

/** Whether any student has a resume at all, for skipping work on an empty pilot. */
export async function anyResumes(): Promise<boolean> {
  const rows = await db
    .select({ id: studentProfiles.userId })
    .from(studentProfiles)
    .where(isNotNull(studentProfiles.resumeFileId))
    .limit(1);
  return rows.length > 0;
}
