import { and, desc, eq, inArray, sql } from "drizzle-orm";
import {
  applications,
  db,
  opportunities,
  placementOutcomes,
  placementReviews,
  users,
} from "@/db";

export type ReviewDirection = "researcher_to_student" | "student_to_researcher";

/**
 * A placement two people can legitimately review each other over.
 *
 * The bar is a real working relationship, not merely an application: either the
 * researcher accepted the student, or somebody reported the placement actually
 * happened. Anything short of that is just an application, and reviewing on the
 * strength of one would let a rejected applicant rate the person who rejected
 * them.
 */
export type ReviewablePlacement = {
  applicationId: string;
  opportunityId: string;
  opportunityTitle: string;
  studentId: string;
  researcherId: string;
  counterpartId: string;
  direction: ReviewDirection;
};

function eligibilityCondition() {
  return sql`(${applications.status} = 'accepted' or ${placementOutcomes.confirmed} = true or ${placementOutcomes.studentReportedOutcome} = 'yes' or ${placementOutcomes.researcherReportedOutcome} = 'yes')`;
}

export async function listReviewablePlacements(userId: string, role: string | null): Promise<ReviewablePlacement[]> {
  if (role !== "student" && role !== "researcher") return [];

  const rows = await db
    .select({
      applicationId: applications.id,
      opportunityId: opportunities.id,
      opportunityTitle: opportunities.title,
      studentId: applications.studentId,
      researcherId: opportunities.researcherId,
    })
    .from(applications)
    .innerJoin(opportunities, eq(opportunities.id, applications.opportunityId))
    .leftJoin(placementOutcomes, eq(placementOutcomes.applicationId, applications.id))
    .where(
      and(
        role === "student" ? eq(applications.studentId, userId) : eq(opportunities.researcherId, userId),
        eligibilityCondition(),
      ),
    )
    .orderBy(desc(applications.updatedAt));

  return rows
    .filter((row) => row.studentId !== row.researcherId)
    .map((row) => ({
      ...row,
      counterpartId: role === "student" ? row.researcherId : row.studentId,
      direction: (role === "student" ? "student_to_researcher" : "researcher_to_student") as ReviewDirection,
    }));
}

/**
 * Authorises one specific review. Checked again inside the action rather than
 * trusted from the form, since the form only decides what to render.
 */
export async function canReview(input: {
  applicationId: string;
  authorId: string;
  direction: ReviewDirection;
}): Promise<{ ok: true; subjectId: string } | { ok: false; reason: string }> {
  const rows = await db
    .select({
      studentId: applications.studentId,
      researcherId: opportunities.researcherId,
      status: applications.status,
      confirmed: placementOutcomes.confirmed,
      studentOutcome: placementOutcomes.studentReportedOutcome,
      researcherOutcome: placementOutcomes.researcherReportedOutcome,
    })
    .from(applications)
    .innerJoin(opportunities, eq(opportunities.id, applications.opportunityId))
    .leftJoin(placementOutcomes, eq(placementOutcomes.applicationId, applications.id))
    .where(eq(applications.id, input.applicationId))
    .limit(1);

  const row = rows[0];
  if (!row) return { ok: false, reason: "That placement could not be found." };

  const worked =
    row.status === "accepted" ||
    row.confirmed === true ||
    row.studentOutcome === "yes" ||
    row.researcherOutcome === "yes";
  if (!worked) {
    return {
      ok: false,
      reason: "You can only review somebody after a placement you both took part in.",
    };
  }

  const expectedAuthor = input.direction === "student_to_researcher" ? row.studentId : row.researcherId;
  const subjectId = input.direction === "student_to_researcher" ? row.researcherId : row.studentId;

  if (expectedAuthor !== input.authorId) {
    return { ok: false, reason: "You were not the one on that side of this placement." };
  }
  if (subjectId === input.authorId) {
    return { ok: false, reason: "You cannot review yourself." };
  }

  return { ok: true, subjectId };
}

export async function listReviewsFor(subjectId: string) {
  return db
    .select({
      review: placementReviews,
      opportunityTitle: opportunities.title,
      authorEmail: users.email,
    })
    .from(placementReviews)
    .innerJoin(applications, eq(applications.id, placementReviews.applicationId))
    .innerJoin(opportunities, eq(opportunities.id, applications.opportunityId))
    .innerJoin(users, eq(users.id, placementReviews.authorId))
    .where(eq(placementReviews.subjectId, subjectId))
    .orderBy(desc(placementReviews.createdAt));
}

export async function reviewSummary(subjectId: string): Promise<{ count: number; average: number | null }> {
  const [row] = await db
    .select({
      count: sql<number>`count(*)::int`,
      average: sql<number | null>`avg(${placementReviews.rating})`,
    })
    .from(placementReviews)
    .where(eq(placementReviews.subjectId, subjectId));

  const count = row?.count ?? 0;
  return { count, average: count > 0 && row?.average !== null ? Number(row.average) : null };
}

export async function reviewsByApplication(applicationIds: string[]) {
  if (applicationIds.length === 0) return new Map<string, (typeof placementReviews.$inferSelect)[]>();
  const rows = await db
    .select()
    .from(placementReviews)
    .where(inArray(placementReviews.applicationId, applicationIds));

  const grouped = new Map<string, (typeof placementReviews.$inferSelect)[]>();
  for (const row of rows) {
    grouped.set(row.applicationId, [...(grouped.get(row.applicationId) ?? []), row]);
  }
  return grouped;
}
