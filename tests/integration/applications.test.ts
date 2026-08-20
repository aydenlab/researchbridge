import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  applicationAnswers,
  applications,
  applicationSnapshots,
  applicationStatusHistory,
  db,
  opportunities,
  savedOpportunities,
  studentProfiles,
} from "@/db";
import { evaluateDeterministic } from "@/lib/criteria/engine";
import { summarizeAlignment } from "@/lib/criteria/weights";
import { loadApplication, loadCriteria, loadCriterionResults, persistCriterionResults } from "@/lib/queries/applications";
import { loadStudentProfile, toApplicantEvidence } from "@/lib/queries/student";
import { searchOpportunities } from "@/lib/queries/opportunities";
import {
  addCriterion,
  addQuestion,
  createApplication,
  createOpportunity,
  createResearcher,
  createStudent,
} from "../fixtures";

describe("duplicate application prevention", () => {
  it("refuses a second application from the same student to the same position", async () => {
    const researcher = await createResearcher();
    const student = await createStudent();
    const opportunity = await createOpportunity(researcher.id);

    await createApplication(opportunity.id, student.id);

    await expect(createApplication(opportunity.id, student.id)).rejects.toThrow();
  });

  it("allows the same student to apply to different positions", async () => {
    const researcher = await createResearcher();
    const student = await createStudent();
    const first = await createOpportunity(researcher.id);
    const second = await createOpportunity(researcher.id);

    await createApplication(first.id, student.id);
    await expect(createApplication(second.id, student.id)).resolves.toBeTruthy();
  });

  it("allows different students to apply to the same position", async () => {
    const researcher = await createResearcher();
    const opportunity = await createOpportunity(researcher.id);
    const first = await createStudent();
    const second = await createStudent();

    await createApplication(opportunity.id, first.id);
    await expect(createApplication(opportunity.id, second.id)).resolves.toBeTruthy();
  });
});

describe("application persistence", () => {
  it("stores answers, a profile snapshot, and status history", async () => {
    const researcher = await createResearcher();
    const student = await createStudent();
    const opportunity = await createOpportunity(researcher.id);
    const question = await addQuestion(opportunity.id);
    const application = await createApplication(opportunity.id, student.id, {
      status: "submitted",
      submittedAt: new Date(),
    });

    await db.insert(applicationAnswers).values({
      applicationId: application.id,
      questionId: question.id,
      textAnswer: "I want to work on clinical outcomes data.",
    });
    await db.insert(applicationSnapshots).values({
      applicationId: application.id,
      profile: { program: "Bachelor of Health Sciences", weeklyHours: 10 },
    });
    await db.insert(applicationStatusHistory).values({
      applicationId: application.id,
      previousStatus: "draft",
      newStatus: "submitted",
      changedBy: student.id,
    });

    const bundle = await loadApplication(application.id);
    expect(bundle?.answers).toHaveLength(1);
    expect(bundle?.history).toHaveLength(1);
    expect(bundle?.questions).toHaveLength(1);
  });

  it("keeps the snapshot unchanged when the student later edits their profile", async () => {
    const researcher = await createResearcher();
    const student = await createStudent();
    const opportunity = await createOpportunity(researcher.id);
    const application = await createApplication(opportunity.id, student.id, {
      status: "submitted",
      submittedAt: new Date(),
    });

    await db.insert(applicationSnapshots).values({
      applicationId: application.id,
      profile: { program: "Bachelor of Health Sciences", weeklyHours: 10 },
    });

    await db.update(studentProfiles).set({ program: "Nursing", weeklyHours: 2 }).where(eq(studentProfiles.userId, student.id));

    const snapshot = await db
      .select()
      .from(applicationSnapshots)
      .where(eq(applicationSnapshots.applicationId, application.id));

    expect(snapshot[0].profile).toMatchObject({ program: "Bachelor of Health Sciences", weeklyHours: 10 });
  });

  it("removes answers when a draft application is deleted", async () => {
    const researcher = await createResearcher();
    const student = await createStudent();
    const opportunity = await createOpportunity(researcher.id);
    const question = await addQuestion(opportunity.id);
    const application = await createApplication(opportunity.id, student.id);

    await db.insert(applicationAnswers).values({
      applicationId: application.id,
      questionId: question.id,
      textAnswer: "Draft answer",
    });

    await db.delete(applications).where(eq(applications.id, application.id));

    const remaining = await db
      .select()
      .from(applicationAnswers)
      .where(eq(applicationAnswers.applicationId, application.id));
    expect(remaining).toHaveLength(0);
  });
});

describe("criterion evaluation storage", () => {
  it("evaluates criteria against a real profile and persists the results", async () => {
    const researcher = await createResearcher();
    const student = await createStudent({ weeklyHours: 10 });
    const opportunity = await createOpportunity(researcher.id);
    await addCriterion(opportunity.id, { label: "At least 6 hours per week", config: { minHoursPerWeek: 6 } });
    await addCriterion(opportunity.id, {
      type: "skill",
      label: "Python",
      required: false,
      importance: "high",
      config: { skillSlug: "python", skillName: "Python" },
      sortOrder: 1,
    });

    const application = await createApplication(opportunity.id, student.id, {
      status: "submitted",
      submittedAt: new Date(),
    });

    const criteria = await loadCriteria(opportunity.id);
    const profile = await loadStudentProfile(student.id);
    expect(profile).not.toBeNull();

    const results = evaluateDeterministic(criteria, toApplicantEvidence(profile!, []));
    await persistCriterionResults(application.id, results);

    const stored = await loadCriterionResults(application.id);
    expect(stored).toHaveLength(2);

    const availability = stored.find((row) => row.status === "met");
    expect(availability?.source).toBe("deterministic");

    const summary = summarizeAlignment(criteria, stored);
    expect(summary.requiredMet).toBe(1);
    expect(summary.preferenceMax).toBe(3);
    expect(summary.preferenceScore).toBe(0);
  });

  it("updates rather than duplicating a result when re-evaluated", async () => {
    const researcher = await createResearcher();
    const student = await createStudent({ weeklyHours: 3 });
    const opportunity = await createOpportunity(researcher.id);
    await addCriterion(opportunity.id, { config: { minHoursPerWeek: 6 } });
    const application = await createApplication(opportunity.id, student.id, {
      status: "submitted",
      submittedAt: new Date(),
    });

    const criteria = await loadCriteria(opportunity.id);
    const profile = await loadStudentProfile(student.id);

    await persistCriterionResults(application.id, evaluateDeterministic(criteria, toApplicantEvidence(profile!, [])));
    const first = await loadCriterionResults(application.id);
    expect(first[0].status).toBe("not_met");

    await db.update(studentProfiles).set({ weeklyHours: 12 }).where(eq(studentProfiles.userId, student.id));
    const updated = await loadStudentProfile(student.id);
    await persistCriterionResults(application.id, evaluateDeterministic(criteria, toApplicantEvidence(updated!, [])));

    const second = await loadCriterionResults(application.id);
    expect(second).toHaveLength(1);
    expect(second[0].status).toBe("met");
  });
});

describe("opportunity search", () => {
  it("returns only published positions by default", async () => {
    const researcher = await createResearcher();
    const published = await createOpportunity(researcher.id, { title: "Published position for search test" });
    const draft = await createOpportunity(researcher.id, { title: "Draft position for search test", status: "draft" });

    const results = await searchOpportunities({ perPage: 200 });
    const ids = results.items.map((item) => item.id);

    expect(ids).toContain(published.id);
    expect(ids).not.toContain(draft.id);
  });

  it("filters by compensation type", async () => {
    const researcher = await createResearcher();
    const paid = await createOpportunity(researcher.id, { compensationType: "paid", compensationDetails: "Hourly" });

    const results = await searchOpportunities({ compensation: ["paid"], perPage: 200 });
    expect(results.items.every((item) => item.compensationType === "paid")).toBe(true);
    expect(results.items.map((item) => item.id)).toContain(paid.id);
  });

  it("excludes positions past their deadline when only open ones are requested", async () => {
    const researcher = await createResearcher();
    const expired = await createOpportunity(researcher.id, {
      deadline: new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10),
    });

    const open = await searchOpportunities({ openOnly: true, perPage: 200 });
    const all = await searchOpportunities({ openOnly: false, perPage: 200 });

    expect(open.items.map((item) => item.id)).not.toContain(expired.id);
    expect(all.items.map((item) => item.id)).toContain(expired.id);
  });

  it("finds a position by a word in its title", async () => {
    const researcher = await createResearcher();
    await createOpportunity(researcher.id, { title: "Neuroimaging Research Assistant for Search" });

    const results = await searchOpportunities({ q: "neuroimaging", perPage: 200 });
    expect(results.items.some((item) => item.title.includes("Neuroimaging"))).toBe(true);
  });
});

describe("saved opportunities", () => {
  it("stores a save once and removes it cleanly", async () => {
    const researcher = await createResearcher();
    const student = await createStudent();
    const opportunity = await createOpportunity(researcher.id);

    await db.insert(savedOpportunities).values({ studentId: student.id, opportunityId: opportunity.id });
    await expect(
      db.insert(savedOpportunities).values({ studentId: student.id, opportunityId: opportunity.id }),
    ).rejects.toThrow();

    await db.delete(savedOpportunities).where(eq(savedOpportunities.studentId, student.id));
    const rows = await db.select().from(savedOpportunities).where(eq(savedOpportunities.studentId, student.id));
    expect(rows).toHaveLength(0);
  });
});

describe("data integrity constraints", () => {
  it("refuses a position with zero openings", async () => {
    const researcher = await createResearcher();
    await expect(createOpportunity(researcher.id, { numberOfOpenings: 0 })).rejects.toThrow();
  });

  it("refuses a maximum below the minimum hours", async () => {
    const researcher = await createResearcher();
    await expect(createOpportunity(researcher.id, { hoursPerWeekMin: 10, hoursPerWeekMax: 4 })).rejects.toThrow();
  });

  it("refuses a negative weekly availability on a profile", async () => {
    await expect(createStudent({ weeklyHours: -3 })).rejects.toThrow();
  });

  it("refuses a duplicate opportunity slug", async () => {
    const researcher = await createResearcher();
    const first = await createOpportunity(researcher.id);
    await expect(createOpportunity(researcher.id, { slug: first.slug })).rejects.toThrow();
  });

  it("cascades a deleted opportunity to its applications", async () => {
    const researcher = await createResearcher();
    const student = await createStudent();
    const opportunity = await createOpportunity(researcher.id);
    const application = await createApplication(opportunity.id, student.id);

    await db.delete(opportunities).where(eq(opportunities.id, opportunity.id));

    const rows = await db.select().from(applications).where(eq(applications.id, application.id));
    expect(rows).toHaveLength(0);
  });
});
