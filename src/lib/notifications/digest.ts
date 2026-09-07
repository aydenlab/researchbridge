import { and, desc, eq, gte, inArray, ne, sql } from "drizzle-orm";
import {
  applications,
  applicationStatusHistory,
  db,
  digestRuns,
  notifications,
  opportunities,
  researcherProfiles,
  studentProfiles,
  users,
} from "@/db";
import { STATUS_LABELS, isActive, type ApplicationStatus } from "@/lib/application-status";
import { sendApplicationStatusDigest, sendWeeklyApplicantDigest } from "@/lib/email";
import { log } from "@/lib/log";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
/** How long an application can sit untouched before silence needs explaining. */
const STALE_DAYS = 14;

export type DigestResult = {
  researchersNotified: number;
  studentsNotified: number;
  failures: number;
  /** Set when a run for this period had already happened and nothing was sent. */
  skipped?: "already_ran";
  periodKey: string;
};

/**
 * ISO week key. Weeks rather than dates because the digest is weekly, and a
 * scheduler that fires an hour late must not count as a new period.
 */
export function isoWeekKey(date: Date): string {
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  // Shift to the Thursday of this week: ISO weeks are numbered by the year
  // their Thursday falls in, which is what makes the boundary unambiguous.
  const day = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function daysSince(date: Date | null): number {
  if (!date) return 0;
  return Math.floor((Date.now() - date.getTime()) / (24 * 60 * 60 * 1000));
}

/**
 * The weekly roll-up, in two halves.
 *
 * Researchers hear about new applicants once a week rather than once per
 * application, because the failure mode this platform exists to fix is a
 * professor's inbox. Students hear where each open application stands, so that
 * the answer to "have they even looked at it" is never nothing at all.
 *
 * Exactly once per ISO week. The period is claimed in the database before any
 * mail goes out, so a scheduler that fires twice, a retry by hand, and a second
 * environment pointed at the same database all find the row already there and
 * do nothing. Pass `force` only when you mean to send a period again.
 */
export async function runWeeklyDigest(
  options: { now?: Date; force?: boolean } = {},
): Promise<DigestResult> {
  const now = options.now ?? new Date();
  const periodKey = isoWeekKey(now);
  const since = new Date(now.getTime() - WEEK_MS);
  const result: DigestResult = { researchersNotified: 0, studentsNotified: 0, failures: 0, periodKey };

  if (!options.force) {
    // Claim the period first. An insert that conflicts means somebody else got
    // here, and the safe answer to "did this already run" is to assume yes.
    const claimed = await db
      .insert(digestRuns)
      .values({ periodKey, startedAt: now })
      .onConflictDoNothing()
      .returning({ periodKey: digestRuns.periodKey });

    if (claimed.length === 0) {
      log.info("weekly_digest_skipped", { periodKey, reason: "already_ran" });
      return { ...result, skipped: "already_ran" };
    }
  }

  await runResearcherDigest(since, result);
  await runStudentDigest(since, result);

  await db
    .insert(digestRuns)
    .values({
      periodKey,
      startedAt: now,
      completedAt: new Date(),
      researchersNotified: result.researchersNotified,
      studentsNotified: result.studentsNotified,
      failures: result.failures,
    })
    .onConflictDoUpdate({
      target: digestRuns.periodKey,
      set: {
        completedAt: new Date(),
        researchersNotified: result.researchersNotified,
        studentsNotified: result.studentsNotified,
        failures: result.failures,
      },
    });

  log.info("weekly_digest_complete", { ...result });
  return result;
}

async function runResearcherDigest(since: Date, result: DigestResult) {
  const rows = await db
    .select({
      researcherId: opportunities.researcherId,
      opportunityId: opportunities.id,
      title: opportunities.title,
      email: users.email,
      firstName: researcherProfiles.firstName,
      lastName: researcherProfiles.lastName,
      newApplicants: sql<number>`count(*) filter (where ${applications.submittedAt} >= ${since.toISOString()})::int`,
      awaitingReview: sql<number>`count(*) filter (where ${applications.status} = 'submitted')::int`,
    })
    .from(applications)
    .innerJoin(opportunities, eq(opportunities.id, applications.opportunityId))
    .innerJoin(researcherProfiles, eq(researcherProfiles.userId, opportunities.researcherId))
    .innerJoin(users, eq(users.id, opportunities.researcherId))
    .where(and(ne(applications.status, "draft"), ne(users.accountStatus, "disabled")))
    .groupBy(
      opportunities.researcherId,
      opportunities.id,
      opportunities.title,
      users.email,
      researcherProfiles.firstName,
      researcherProfiles.lastName,
    );

  const byResearcher = new Map<
    string,
    {
      email: string;
      name: string;
      postings: { title: string; newApplicants: number; awaitingReview: number }[];
    }
  >();

  for (const row of rows) {
    if (row.newApplicants === 0 && row.awaitingReview === 0) continue;
    const entry = byResearcher.get(row.researcherId) ?? {
      email: row.email,
      name: `${row.firstName} ${row.lastName}`.trim(),
      postings: [],
    };
    entry.postings.push({
      title: row.title,
      newApplicants: row.newApplicants,
      awaitingReview: row.awaitingReview,
    });
    byResearcher.set(row.researcherId, entry);
  }

  for (const [researcherId, entry] of byResearcher) {
    const newApplicants = entry.postings.reduce((total, posting) => total + posting.newApplicants, 0);
    const awaitingReview = entry.postings.reduce((total, posting) => total + posting.awaitingReview, 0);

    // Nothing new and nothing waiting means there is nothing worth an email.
    if (newApplicants === 0 && awaitingReview === 0) continue;

    try {
      await sendWeeklyApplicantDigest({
        to: entry.email,
        researcherName: entry.name,
        newApplicants,
        awaitingReview,
        postings: entry.postings.filter((posting) => posting.newApplicants > 0 || posting.awaitingReview > 0),
      });

      await db.insert(notifications).values({
        userId: researcherId,
        type: "weekly_digest",
        title:
          newApplicants > 0
            ? `${newApplicants} new ${newApplicants === 1 ? "application" : "applications"} this week`
            : `${awaitingReview} ${awaitingReview === 1 ? "application is" : "applications are"} waiting for you`,
        body: entry.postings.map((posting) => posting.title).join(", "),
        link: "/researcher/applicants",
      });

      result.researchersNotified += 1;
    } catch (error) {
      result.failures += 1;
      log.error("weekly_digest_researcher_failed", { researcherId, error });
    }
  }
}

async function runStudentDigest(since: Date, result: DigestResult) {
  const rows = await db
    .select({
      studentId: applications.studentId,
      applicationId: applications.id,
      status: applications.status,
      updatedAt: applications.updatedAt,
      submittedAt: applications.submittedAt,
      title: opportunities.title,
      email: users.email,
      firstName: studentProfiles.firstName,
      preferredName: studentProfiles.preferredName,
    })
    .from(applications)
    .innerJoin(opportunities, eq(opportunities.id, applications.opportunityId))
    .innerJoin(studentProfiles, eq(studentProfiles.userId, applications.studentId))
    .innerJoin(users, eq(users.id, applications.studentId))
    .where(and(ne(applications.status, "draft"), ne(users.accountStatus, "disabled")))
    .orderBy(desc(applications.updatedAt));

  const open = rows.filter((row) => isActive(row.status as ApplicationStatus));
  if (open.length === 0) return;

  const changedRows = await db
    .select({ applicationId: applicationStatusHistory.applicationId })
    .from(applicationStatusHistory)
    .where(
      and(
        inArray(
          applicationStatusHistory.applicationId,
          open.map((row) => row.applicationId),
        ),
        gte(applicationStatusHistory.createdAt, since),
      ),
    );
  const changed = new Set(changedRows.map((row) => row.applicationId));

  const byStudent = new Map<
    string,
    {
      email: string;
      name: string;
      applications: { title: string; statusLabel: string; waitingDays: number; changed: boolean }[];
      worthSending: boolean;
    }
  >();

  for (const row of open) {
    const waitingDays = daysSince(row.updatedAt ?? row.submittedAt);
    const didChange = changed.has(row.applicationId);
    const entry = byStudent.get(row.studentId) ?? {
      email: row.email,
      name: row.preferredName ?? row.firstName,
      applications: [],
      worthSending: false,
    };
    entry.applications.push({
      title: row.title,
      statusLabel: STATUS_LABELS[row.status as ApplicationStatus],
      waitingDays,
      changed: didChange,
    });
    // Only worth an email if something moved, or something has gone quiet for
    // long enough that the student deserves to be told it has.
    if (didChange || waitingDays >= STALE_DAYS) entry.worthSending = true;
    byStudent.set(row.studentId, entry);
  }

  for (const [studentId, entry] of byStudent) {
    if (!entry.worthSending) continue;
    try {
      await sendApplicationStatusDigest({
        to: entry.email,
        studentName: entry.name,
        applications: entry.applications,
      });

      await db.insert(notifications).values({
        userId: studentId,
        type: "application_status_digest",
        title: "Where your applications stand",
        body: entry.applications
          .map((application) => `${application.title}: ${application.statusLabel.toLowerCase()}`)
          .join(". "),
        link: "/applications",
      });

      result.studentsNotified += 1;
    } catch (error) {
      result.failures += 1;
      log.error("weekly_digest_student_failed", { studentId, error });
    }
  }
}
