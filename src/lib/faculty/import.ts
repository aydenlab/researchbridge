import { and, asc, eq, isNull, isNotNull, sql } from "drizzle-orm";
import { db, researcherFields, researcherProfiles, users } from "@/db";
import { normalizeEmail, resolveInstitutionForEmail } from "@/lib/auth/codes";
import { log } from "@/lib/log";
import { ensureResearchField } from "@/lib/queries/taxonomy";
import { parseCsv, readField, splitAreas, type CsvRow } from "./csv";

export type FacultyCandidate = {
  email: string;
  firstName: string;
  lastName: string;
  title: string | null;
  department: string | null;
  faculty: string | null;
  labName: string | null;
  labWebsite: string | null;
  personalWebsite: string | null;
  linkedinUrl: string | null;
  orcidId: string | null;
  biography: string | null;
  researchAreas: string[];
  researcherType: (typeof researcherProfiles.$inferInsert)["researcherType"];
};

export type FacultyRowOutcome =
  | { status: "ready"; candidate: FacultyCandidate; existing: "new" | "prefilled" | "claimed" }
  | { status: "rejected"; email: string; reason: string };

const RESEARCHER_TYPES = new Set([
  "faculty",
  "professor",
  "principal_investigator",
  "postdoc",
  "phd_student",
  "masters_student",
  "lab_manager",
  "research_staff",
  "student_lead",
  "other",
]);

function optional(value: string, max: number): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  return trimmed.slice(0, max);
}

function normalizeUrl(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  // Faculty exports routinely give a bare host. Assuming https is safe here and
  // saves an admin from hand-editing a few hundred rows.
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return /^https?:\/\/\S+\.\S+/i.test(withScheme) ? withScheme.slice(0, 400) : null;
}

function guessResearcherType(title: string): FacultyCandidate["researcherType"] {
  const value = title.toLowerCase();
  if (RESEARCHER_TYPES.has(value.replace(/\s+/g, "_"))) {
    return value.replace(/\s+/g, "_") as FacultyCandidate["researcherType"];
  }
  if (/principal investigator|^pi$/.test(value)) return "principal_investigator";
  if (/professor|prof\b/.test(value)) return "professor";
  if (/postdoc/.test(value)) return "postdoc";
  if (/lab manager/.test(value)) return "lab_manager";
  if (/lecturer|instructor|faculty/.test(value)) return "faculty";
  return "faculty";
}

/**
 * Reads a pasted CSV into candidates, saying for each row whether it would
 * create an account, refresh an unclaimed one, or be left alone because the
 * person has already taken ownership of their profile.
 *
 * Nothing is written here. The admin sees exactly this before deciding.
 */
export async function planFacultyImport(csv: string): Promise<{
  headers: string[];
  outcomes: FacultyRowOutcome[];
}> {
  const { headers, rows } = parseCsv(csv);
  const outcomes: FacultyRowOutcome[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const outcome = await planRow(row, seen);
    if (outcome) outcomes.push(outcome);
  }

  return { headers, outcomes };
}

async function planRow(row: CsvRow, seen: Set<string>): Promise<FacultyRowOutcome | null> {
  const rawEmail = readField(row, "email");
  if (!rawEmail) return null;

  const email = normalizeEmail(rawEmail);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { status: "rejected", email: rawEmail, reason: "Not a valid email address." };
  }
  if (seen.has(email)) {
    return { status: "rejected", email, reason: "Listed more than once in this file." };
  }
  seen.add(email);

  const firstName = readField(row, "firstName");
  const lastName = readField(row, "lastName");
  if (!firstName || !lastName) {
    return { status: "rejected", email, reason: "Missing a first or last name." };
  }

  const existingRows = await db
    .select({
      id: users.id,
      role: users.role,
      claimedAt: researcherProfiles.claimedAt,
      prefilledSource: researcherProfiles.prefilledSource,
    })
    .from(users)
    .leftJoin(researcherProfiles, eq(researcherProfiles.userId, users.id))
    .where(eq(users.email, email))
    .limit(1);

  const existing = existingRows[0];
  if (existing && existing.role && existing.role !== "researcher") {
    return { status: "rejected", email, reason: `Already registered as a ${existing.role}.` };
  }
  if (existing?.claimedAt) {
    return {
      status: "rejected",
      email,
      reason: "This person has already confirmed their own profile, so the import leaves it alone.",
    };
  }

  const title = readField(row, "title");

  return {
    status: "ready",
    existing: existing ? (existing.prefilledSource ? "prefilled" : "claimed") : "new",
    candidate: {
      email,
      firstName: firstName.slice(0, 80),
      lastName: lastName.slice(0, 80),
      title: optional(title, 160),
      department: optional(readField(row, "department"), 160),
      faculty: optional(readField(row, "faculty"), 160),
      labName: optional(readField(row, "labName"), 160),
      labWebsite: normalizeUrl(readField(row, "labWebsite")),
      personalWebsite: normalizeUrl(readField(row, "personalWebsite")),
      linkedinUrl: normalizeUrl(readField(row, "linkedinUrl")),
      orcidId: optional(readField(row, "orcidId"), 40),
      biography: optional(readField(row, "biography"), 2500),
      researchAreas: splitAreas(readField(row, "researchAreas")),
      researcherType: guessResearcherType(title),
    },
  };
}

/**
 * Adds or refreshes one person typed into the admin form. The fields go through
 * the same row checks as an import, so the one-at-a-time path cannot write
 * anything a CSV would have been refused for, and a claimed profile is still
 * left alone.
 */
export async function addFacultyMember(
  fields: Partial<Record<keyof FacultyCandidate, string>>,
  options: { source: string; institutionId?: string | null },
): Promise<{ ok: true; created: boolean; email: string } | { ok: false; reason: string }> {
  const row: CsvRow = {
    email: fields.email ?? "",
    firstname: fields.firstName ?? "",
    lastname: fields.lastName ?? "",
    title: fields.title ?? "",
    department: fields.department ?? "",
    faculty: fields.faculty ?? "",
    labname: fields.labName ?? "",
    labwebsite: fields.labWebsite ?? "",
    personalwebsite: fields.personalWebsite ?? "",
    linkedin: fields.linkedinUrl ?? "",
    orcid: fields.orcidId ?? "",
    biography: fields.biography ?? "",
    researchareas: fields.researchAreas ?? "",
  };

  const outcome = await planRow(row, new Set());
  if (!outcome) return { ok: false, reason: "An email address is required." };
  if (outcome.status === "rejected") return { ok: false, reason: outcome.reason };

  const created = await upsertCandidate(outcome.candidate, options);
  log.info("faculty_member_added", { source: options.source, created });
  return { ok: true, created, email: outcome.candidate.email };
}

export type FacultyImportResult = {
  created: number;
  refreshed: number;
  rejected: number;
  reasons: { email: string; reason: string }[];
};

/**
 * Writes the plan.
 *
 * An imported account is created verified: it came off the institution's own
 * faculty list, which is a stronger check than the one an administrator does by
 * hand for a self-signup. It stays `pending` as an account until the person
 * signs in, so an unclaimed row is never counted as an active user.
 *
 * A profile somebody has already claimed is never touched, so re-running the
 * import as the list grows is safe.
 */
export async function applyFacultyImport(
  csv: string,
  options: { source: string; institutionId?: string | null },
): Promise<FacultyImportResult> {
  const { outcomes } = await planFacultyImport(csv);
  const result: FacultyImportResult = { created: 0, refreshed: 0, rejected: 0, reasons: [] };

  for (const outcome of outcomes) {
    if (outcome.status === "rejected") {
      result.rejected += 1;
      result.reasons.push({ email: outcome.email, reason: outcome.reason });
      continue;
    }

    try {
      const wasNew = await upsertCandidate(outcome.candidate, options);
      if (wasNew) result.created += 1;
      else result.refreshed += 1;
    } catch (error) {
      result.rejected += 1;
      result.reasons.push({ email: outcome.candidate.email, reason: "Could not be saved. See the server log." });
      log.error("faculty_import_row_failed", { email: outcome.candidate.email, error });
    }
  }

  log.info("faculty_import_complete", {
    source: options.source,
    created: result.created,
    refreshed: result.refreshed,
    rejected: result.rejected,
  });

  return result;
}

async function upsertCandidate(
  candidate: FacultyCandidate,
  options: { source: string; institutionId?: string | null },
): Promise<boolean> {
  const institution = options.institutionId ?? (await resolveInstitutionForEmail(candidate.email))?.id ?? null;
  const now = new Date();

  const existingRows = await db.select({ id: users.id }).from(users).where(eq(users.email, candidate.email)).limit(1);
  let userId = existingRows[0]?.id;
  const wasNew = !userId;

  if (!userId) {
    const [created] = await db
      .insert(users)
      .values({
        email: candidate.email,
        role: "researcher",
        // Pending until they actually sign in. An imported row is an invitation,
        // not a user, and counting it as one would flatter every pilot metric.
        accountStatus: "pending",
        institutionId: institution,
      })
      .returning({ id: users.id });
    userId = created.id;
  } else {
    await db
      .update(users)
      .set({ role: "researcher", institutionId: institution, updatedAt: now })
      .where(eq(users.id, userId));
  }

  const profileValues = {
    firstName: candidate.firstName,
    lastName: candidate.lastName,
    researcherType: candidate.researcherType,
    title: candidate.title,
    department: candidate.department,
    faculty: candidate.faculty,
    labName: candidate.labName,
    labWebsite: candidate.labWebsite,
    personalWebsite: candidate.personalWebsite,
    linkedinUrl: candidate.linkedinUrl,
    orcidId: candidate.orcidId,
    biography: candidate.biography,
    verificationStatus: "verified" as const,
    approvedAt: now,
    prefilledSource: options.source,
    prefilledAt: now,
    onboardingStep: 1,
    updatedAt: now,
  };

  await db
    .insert(researcherProfiles)
    .values({ userId, ...profileValues })
    .onConflictDoUpdate({
      target: researcherProfiles.userId,
      // The where clause is what makes a re-import safe: once somebody has
      // confirmed their own details, the import stops being allowed to
      // overwrite them.
      set: profileValues,
      setWhere: isNull(researcherProfiles.claimedAt),
    });

  if (candidate.researchAreas.length > 0) {
    const fieldIds: string[] = [];
    for (const area of candidate.researchAreas) {
      fieldIds.push(await ensureResearchField(area));
    }
    await db
      .insert(researcherFields)
      .values([...new Set(fieldIds)].map((researchFieldId) => ({ researcherId: userId, researchFieldId })))
      .onConflictDoNothing();
  }

  return wasNew;
}

/** Imported accounts that nobody has signed in to claim yet. */
export async function listUnclaimedFaculty(limit = 100) {
  return db
    .select({
      userId: researcherProfiles.userId,
      email: users.email,
      firstName: researcherProfiles.firstName,
      lastName: researcherProfiles.lastName,
      title: researcherProfiles.title,
      department: researcherProfiles.department,
      prefilledSource: researcherProfiles.prefilledSource,
      prefilledAt: researcherProfiles.prefilledAt,
      lastLoginAt: users.lastLoginAt,
    })
    .from(researcherProfiles)
    .innerJoin(users, eq(users.id, researcherProfiles.userId))
    .where(and(isNotNull(researcherProfiles.prefilledSource), isNull(researcherProfiles.claimedAt)))
    .orderBy(asc(researcherProfiles.lastName))
    .limit(limit);
}

export async function facultyImportSummary() {
  const [row] = await db
    .select({
      prefilled: sql<number>`count(*) filter (where ${researcherProfiles.prefilledSource} is not null)::int`,
      claimed: sql<number>`count(*) filter (where ${researcherProfiles.prefilledSource} is not null and ${researcherProfiles.claimedAt} is not null)::int`,
    })
    .from(researcherProfiles);

  return { prefilled: row?.prefilled ?? 0, claimed: row?.claimed ?? 0 };
}
