import { NextResponse } from "next/server";
import { desc, eq, ne } from "drizzle-orm";
import {
  applications,
  db,
  institutions,
  opportunities,
  placementOutcomes,
  researcherProfiles,
  studentProfiles,
  users,
  waitlistEntries,
} from "@/db";
import { getSessionUser } from "@/lib/auth/session";
import { recordAudit } from "@/lib/events";
import { log } from "@/lib/log";

export const dynamic = "force-dynamic";

const DATASETS = ["waitlist", "researchers", "opportunities", "applications", "placements", "users"] as const;
type Dataset = (typeof DATASETS)[number];

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = value instanceof Date ? value.toISOString() : String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function toCsv(headers: string[], rows: unknown[][]): string {
  return [headers.join(","), ...rows.map((row) => row.map(csvCell).join(","))].join("\r\n");
}

async function buildDataset(dataset: Dataset): Promise<{ headers: string[]; rows: unknown[][] }> {
  if (dataset === "waitlist") {
    const rows = await db.select().from(waitlistEntries).orderBy(desc(waitlistEntries.createdAt));
    return {
      headers: [
        "kind",
        "first_name",
        "last_name",
        "email",
        "program",
        "year_level",
        "research_interests",
        "title",
        "department",
        "lab_name",
        "expected_student_count",
        "help_needed",
        "willing_to_pilot",
        "contact_consent",
        "status",
        "created_at",
      ],
      rows: rows.map((row) => [
        row.kind,
        row.firstName,
        row.lastName,
        row.email,
        row.program,
        row.yearLevel,
        row.researchInterests,
        row.title,
        row.department,
        row.labName,
        row.expectedStudentCount,
        row.helpNeeded,
        row.willingToPilot,
        row.contactConsent,
        row.status,
        row.createdAt,
      ]),
    };
  }

  if (dataset === "researchers") {
    const rows = await db
      .select({
        email: users.email,
        firstName: researcherProfiles.firstName,
        lastName: researcherProfiles.lastName,
        researcherType: researcherProfiles.researcherType,
        title: researcherProfiles.title,
        faculty: researcherProfiles.faculty,
        department: researcherProfiles.department,
        labName: researcherProfiles.labName,
        verificationStatus: researcherProfiles.verificationStatus,
        approvedAt: researcherProfiles.approvedAt,
        institution: institutions.name,
        createdAt: researcherProfiles.createdAt,
      })
      .from(researcherProfiles)
      .innerJoin(users, eq(users.id, researcherProfiles.userId))
      .leftJoin(institutions, eq(institutions.id, users.institutionId))
      .orderBy(desc(researcherProfiles.createdAt));

    return {
      headers: [
        "email",
        "first_name",
        "last_name",
        "researcher_type",
        "title",
        "faculty",
        "department",
        "lab_name",
        "verification_status",
        "approved_at",
        "institution",
        "created_at",
      ],
      rows: rows.map((row) => Object.values(row)),
    };
  }

  if (dataset === "opportunities") {
    const rows = await db
      .select({
        title: opportunities.title,
        status: opportunities.status,
        department: opportunities.department,
        labName: opportunities.labName,
        compensationType: opportunities.compensationType,
        locationMode: opportunities.locationMode,
        numberOfOpenings: opportunities.numberOfOpenings,
        hoursMin: opportunities.hoursPerWeekMin,
        hoursMax: opportunities.hoursPerWeekMax,
        deadline: opportunities.deadline,
        beginnerFriendly: opportunities.beginnerFriendly,
        priorResearchRequired: opportunities.priorResearchRequired,
        viewCount: opportunities.viewCount,
        publishedAt: opportunities.publishedAt,
        researcher: researcherProfiles.lastName,
        institution: institutions.name,
        createdAt: opportunities.createdAt,
      })
      .from(opportunities)
      .innerJoin(researcherProfiles, eq(researcherProfiles.userId, opportunities.researcherId))
      .leftJoin(institutions, eq(institutions.id, opportunities.institutionId))
      .orderBy(desc(opportunities.createdAt));

    return {
      headers: [
        "title",
        "status",
        "department",
        "lab_name",
        "compensation_type",
        "location_mode",
        "number_of_openings",
        "hours_min",
        "hours_max",
        "deadline",
        "beginner_friendly",
        "prior_research_required",
        "view_count",
        "published_at",
        "researcher_last_name",
        "institution",
        "created_at",
      ],
      rows: rows.map((row) => Object.values(row)),
    };
  }

  if (dataset === "applications") {
    const rows = await db
      .select({
        opportunityTitle: opportunities.title,
        researcherLastName: researcherProfiles.lastName,
        studentProgram: studentProfiles.program,
        studentYear: studentProfiles.yearLevel,
        studentWeeklyHours: studentProfiles.weeklyHours,
        status: applications.status,
        submittedAt: applications.submittedAt,
        reviewedAt: applications.reviewedAt,
        contactedAt: applications.contactedAt,
        withdrawnAt: applications.withdrawnAt,
        institution: institutions.name,
      })
      .from(applications)
      .innerJoin(opportunities, eq(opportunities.id, applications.opportunityId))
      .innerJoin(researcherProfiles, eq(researcherProfiles.userId, opportunities.researcherId))
      .innerJoin(studentProfiles, eq(studentProfiles.userId, applications.studentId))
      .leftJoin(institutions, eq(institutions.id, opportunities.institutionId))
      .where(ne(applications.status, "draft"))
      .orderBy(desc(applications.submittedAt));

    return {
      headers: [
        "opportunity_title",
        "researcher_last_name",
        "student_program",
        "student_year",
        "student_weekly_hours",
        "status",
        "submitted_at",
        "reviewed_at",
        "contacted_at",
        "withdrawn_at",
        "institution",
      ],
      rows: rows.map((row) => Object.values(row)),
    };
  }

  if (dataset === "placements") {
    const rows = await db
      .select({
        opportunityTitle: opportunities.title,
        studentProgram: studentProfiles.program,
        studentReported: placementOutcomes.studentReportedOutcome,
        researcherReported: placementOutcomes.researcherReportedOutcome,
        confirmed: placementOutcomes.confirmed,
        startDate: placementOutcomes.startDate,
        positionType: placementOutcomes.positionType,
        studentWouldUseAgain: placementOutcomes.studentWouldUseAgain,
        researcherWouldUseAgain: placementOutcomes.researcherWouldUseAgain,
        createdAt: placementOutcomes.createdAt,
      })
      .from(placementOutcomes)
      .innerJoin(applications, eq(applications.id, placementOutcomes.applicationId))
      .innerJoin(opportunities, eq(opportunities.id, applications.opportunityId))
      .innerJoin(studentProfiles, eq(studentProfiles.userId, applications.studentId))
      .orderBy(desc(placementOutcomes.createdAt));

    return {
      headers: [
        "opportunity_title",
        "student_program",
        "student_reported_outcome",
        "researcher_reported_outcome",
        "confirmed",
        "start_date",
        "position_type",
        "student_would_use_again",
        "researcher_would_use_again",
        "created_at",
      ],
      rows: rows.map((row) => Object.values(row)),
    };
  }

  const rows = await db
    .select({
      email: users.email,
      role: users.role,
      accountStatus: users.accountStatus,
      institution: institutions.name,
      emailVerifiedAt: users.emailVerifiedAt,
      onboardingCompletedAt: users.onboardingCompletedAt,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
    })
    .from(users)
    .leftJoin(institutions, eq(institutions.id, users.institutionId))
    .orderBy(desc(users.createdAt));

  return {
    headers: [
      "email",
      "role",
      "account_status",
      "institution",
      "email_verified_at",
      "onboarding_completed_at",
      "last_login_at",
      "created_at",
    ],
    rows: rows.map((row) => Object.values(row)),
  };
}

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (user.role !== "admin") {
    log.warn("authorization_denied", { action: "admin_export", userId: user.id });
    return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
  }

  const url = new URL(request.url);
  const dataset = url.searchParams.get("dataset") as Dataset | null;
  if (!dataset || !DATASETS.includes(dataset)) {
    return NextResponse.json({ error: `Choose one of: ${DATASETS.join(", ")}.` }, { status: 400 });
  }

  const { headers, rows } = await buildDataset(dataset);
  await recordAudit({ actorId: user.id, action: "admin_export", subjectType: "dataset", detail: { dataset, rows: rows.length } });

  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(toCsv(headers, rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="researchbridge-${dataset}-${stamp}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
