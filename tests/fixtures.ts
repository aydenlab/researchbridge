import { randomUUID } from "node:crypto";
import {
  applications,
  db,
  institutionEmailDomains,
  institutions,
  opportunities,
  opportunityCriteria,
  opportunityQuestions,
  researcherProfiles,
  studentProfiles,
  users,
} from "@/db";

let institutionId: string | null = null;

export async function ensureInstitution(): Promise<string> {
  if (institutionId) return institutionId;
  const [row] = await db
    .insert(institutions)
    .values({
      name: "Example University",
      slug: `example-university-${randomUUID().slice(0, 8)}`,
      location: "Springfield",
      gpaScaleName: "12 point",
      gpaScaleMax: "12",
      active: true,
      isPilot: true,
    })
    .returning({ id: institutions.id });
  institutionId = row.id;
  await db.insert(institutionEmailDomains).values({ institutionId: row.id, domain: "example.edu" });
  return row.id;
}

export async function createStudent(overrides: Partial<typeof studentProfiles.$inferInsert> = {}) {
  const institution = await ensureInstitution();
  const [user] = await db
    .insert(users)
    .values({
      email: `student-${randomUUID().slice(0, 12)}@example.edu`,
      role: "student",
      accountStatus: "active",
      institutionId: institution,
      emailVerifiedAt: new Date(),
      onboardingCompletedAt: new Date(),
    })
    .returning();

  await db.insert(studentProfiles).values({
    userId: user.id,
    firstName: "Test",
    lastName: "Student",
    degreeLevel: "undergraduate",
    program: "Bachelor of Health Sciences",
    yearLevel: 2,
    graduationYear: 2028,
    weeklyHours: 10,
    locationPreference: "hybrid",
    profileCompletion: 90,
    ...overrides,
  });

  return user;
}

export async function createResearcher(verified = true) {
  const institution = await ensureInstitution();
  const [user] = await db
    .insert(users)
    .values({
      email: `researcher-${randomUUID().slice(0, 12)}@example.edu`,
      role: "researcher",
      accountStatus: "active",
      institutionId: institution,
      emailVerifiedAt: new Date(),
      onboardingCompletedAt: new Date(),
    })
    .returning();

  await db.insert(researcherProfiles).values({
    userId: user.id,
    firstName: "Test",
    lastName: "Researcher",
    researcherType: "principal_investigator",
    department: "Health Research Methods, Evidence, and Impact",
    biography: "A fictional research group used only in the test suite.",
    verificationStatus: verified ? "verified" : "pending",
    approvedAt: verified ? new Date() : null,
  });

  return user;
}

export async function createOpportunity(
  researcherId: string,
  overrides: Partial<typeof opportunities.$inferInsert> = {},
) {
  const institution = await ensureInstitution();
  const [row] = await db
    .insert(opportunities)
    .values({
      institutionId: institution,
      researcherId,
      title: "Undergraduate Research Assistant",
      slug: `opportunity-${randomUUID().slice(0, 12)}`,
      summary: "A fictional position used only in the test suite.",
      description: "Detailed description used by the test suite.",
      responsibilities: "Clean data.\nAttend lab meeting.",
      department: "Health Research Methods, Evidence, and Impact",
      status: "published",
      numberOfOpenings: 1,
      locationMode: "hybrid",
      hoursPerWeekMin: 6,
      hoursPerWeekMax: 10,
      deadline: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      compensationType: "academic_credit",
      beginnerFriendly: true,
      publishedAt: new Date(),
      ...overrides,
    })
    .returning();
  return row;
}

export async function addQuestion(
  opportunityId: string,
  overrides: Partial<typeof opportunityQuestions.$inferInsert> = {},
) {
  const [row] = await db
    .insert(opportunityQuestions)
    .values({
      opportunityId,
      type: "long_text",
      prompt: "What interests you about this project?",
      required: true,
      config: { maxLength: 2000 },
      sortOrder: 0,
      ...overrides,
    })
    .returning();
  return row;
}

export async function addCriterion(
  opportunityId: string,
  overrides: Partial<typeof opportunityCriteria.$inferInsert> = {},
) {
  const [row] = await db
    .insert(opportunityCriteria)
    .values({
      opportunityId,
      type: "availability",
      label: "At least 6 hours per week",
      required: true,
      importance: "required",
      config: { minHoursPerWeek: 6 },
      sortOrder: 0,
      ...overrides,
    })
    .returning();
  return row;
}

export async function createApplication(
  opportunityId: string,
  studentId: string,
  overrides: Partial<typeof applications.$inferInsert> = {},
) {
  const [row] = await db
    .insert(applications)
    .values({ opportunityId, studentId, status: "draft", ...overrides })
    .returning();
  return row;
}

export async function createApplicationGraph() {
  const researcher = await createResearcher();
  const student = await createStudent();
  const opportunity = await createOpportunity(researcher.id);
  const question = await addQuestion(opportunity.id);
  const application = await createApplication(opportunity.id, student.id, {
    status: "submitted",
    submittedAt: new Date(),
  });
  return { researcher, student, opportunity, question, application };
}
