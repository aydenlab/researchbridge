import { beforeEach, describe, expect, it, vi } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import { applications, applicationStatusHistory, db, notifications } from "@/db";
import { runWeeklyDigest } from "@/lib/notifications/digest";
import { createApplication, createOpportunity, createResearcher, createStudent } from "../fixtures";

async function clearNotifications() {
  await db.delete(notifications);
}

async function notificationsOfType(userId: string, type: string) {
  return db
    .select()
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.type, type)));
}

/** Backdates an application so the digest sees it as having gone quiet. */
async function ageApplication(applicationId: string, days: number) {
  await db
    .update(applications)
    .set({ updatedAt: sql`now() - ${`${days} days`}::interval` })
    .where(eq(applications.id, applicationId));
}

describe("weekly researcher digest", () => {
  beforeEach(async () => {
    await db.delete(applications);
    await clearNotifications();
  });

  it("tells a researcher how many applications arrived and how many are waiting", async () => {
    const researcher = await createResearcher();
    const opportunity = await createOpportunity(researcher.id, { title: "Cardiac outcomes assistant" });
    await createApplication(opportunity.id, (await createStudent()).id, {
      status: "submitted",
      submittedAt: new Date(),
    });
    await createApplication(opportunity.id, (await createStudent()).id, {
      status: "submitted",
      submittedAt: new Date(),
    });

    const result = await runWeeklyDigest();
    expect(result.researchersNotified).toBe(1);
    expect(result.failures).toBe(0);

    const [notice] = await notificationsOfType(researcher.id, "weekly_digest");
    expect(notice.title).toContain("2 new applications");
    expect(notice.body).toContain("Cardiac outcomes assistant");
  });

  it("says nothing to a researcher with no applicants at all", async () => {
    const researcher = await createResearcher();
    await createOpportunity(researcher.id);

    const result = await runWeeklyDigest();
    expect(result.researchersNotified).toBe(0);
    expect(await notificationsOfType(researcher.id, "weekly_digest")).toHaveLength(0);
  });

  it("ignores drafts, which the researcher cannot see yet", async () => {
    const researcher = await createResearcher();
    const opportunity = await createOpportunity(researcher.id);
    await createApplication(opportunity.id, (await createStudent()).id, { status: "draft" });

    const result = await runWeeklyDigest();
    expect(result.researchersNotified).toBe(0);
  });
});

describe("student status digest", () => {
  beforeEach(async () => {
    await db.delete(applications);
    await clearNotifications();
  });

  it("writes to a student when their application moved this week", async () => {
    const researcher = await createResearcher();
    const student = await createStudent();
    const opportunity = await createOpportunity(researcher.id, { title: "Sleep study assistant" });
    const application = await createApplication(opportunity.id, student.id, {
      status: "shortlisted",
      submittedAt: new Date(),
    });
    await db.insert(applicationStatusHistory).values({
      applicationId: application.id,
      previousStatus: "submitted",
      newStatus: "shortlisted",
    });

    const result = await runWeeklyDigest();
    expect(result.studentsNotified).toBe(1);

    const [notice] = await notificationsOfType(student.id, "application_status_digest");
    expect(notice.body).toContain("Sleep study assistant");
    expect(notice.body).toContain("shortlisted");
  });

  it("writes to a student whose application has gone quiet, so silence is never the only answer", async () => {
    const researcher = await createResearcher();
    const student = await createStudent();
    const opportunity = await createOpportunity(researcher.id);
    const application = await createApplication(opportunity.id, student.id, {
      status: "submitted",
      submittedAt: new Date(),
    });
    await ageApplication(application.id, 20);

    const result = await runWeeklyDigest();
    expect(result.studentsNotified).toBe(1);
    expect(await notificationsOfType(student.id, "application_status_digest")).toHaveLength(1);
  });

  it("stays quiet about a fresh application that has not moved", async () => {
    const researcher = await createResearcher();
    const student = await createStudent();
    const opportunity = await createOpportunity(researcher.id);
    await createApplication(opportunity.id, student.id, { status: "submitted", submittedAt: new Date() });

    const result = await runWeeklyDigest();
    expect(result.studentsNotified).toBe(0);
  });

  it("stays quiet about applications that are already finished", async () => {
    const researcher = await createResearcher();
    const student = await createStudent();
    const opportunity = await createOpportunity(researcher.id);
    const application = await createApplication(opportunity.id, student.id, {
      status: "declined",
      submittedAt: new Date(),
    });
    await ageApplication(application.id, 40);

    const result = await runWeeklyDigest();
    expect(result.studentsNotified).toBe(0);
  });

  it("survives a delivery failure without abandoning the rest of the run", async () => {
    const researcher = await createResearcher();
    const opportunity = await createOpportunity(researcher.id);
    await createApplication(opportunity.id, (await createStudent()).id, {
      status: "submitted",
      submittedAt: new Date(),
    });

    const providers = await import("@/lib/email/providers");
    const spy = vi.spyOn(providers, "resolveProvider").mockImplementation(() => ({
      name: "failing",
      async send() {
        throw new Error("provider is down");
      },
    }));

    const result = await runWeeklyDigest();
    expect(result.failures).toBeGreaterThan(0);
    spy.mockRestore();
  });
});
