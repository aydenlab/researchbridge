import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { applications, db, digestRuns, notifications } from "@/db";
import { dueAt, isDue, maybeRunWeeklyDigest, resetDigestScheduleForTests } from "@/lib/notifications/schedule";
import { createApplication, createOpportunity, createResearcher, createStudent } from "../fixtures";

/** The autorun is fire-and-forget, so a case has to wait for it to settle. */
async function settle() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 25));
    const rows = await db.select().from(digestRuns);
    if (rows.some((row) => row.completedAt !== null)) return rows;
  }
  return db.select().from(digestRuns);
}

describe("when the digest becomes due", () => {
  it("is due from Monday at 13:00 UTC", () => {
    // 2026-09-07 is a Monday.
    expect(isDue(new Date("2026-09-07T12:59:00Z"))).toBe(false);
    expect(isDue(new Date("2026-09-07T13:00:00Z"))).toBe(true);
  });

  it("stays due for the rest of the week, so a quiet Monday does not lose it", () => {
    expect(isDue(new Date("2026-09-10T04:00:00Z"))).toBe(true);
    expect(isDue(new Date("2026-09-13T23:00:00Z"))).toBe(true);
  });

  it("counts Sunday as the end of its week rather than the start of the next", () => {
    // Sunday 13 September belongs to the week beginning Monday 7 September.
    expect(dueAt(new Date("2026-09-13T10:00:00Z")).toISOString()).toBe("2026-09-07T13:00:00.000Z");
    expect(dueAt(new Date("2026-09-14T10:00:00Z")).toISOString()).toBe("2026-09-14T13:00:00.000Z");
  });
});

describe("running off a heartbeat", () => {
  beforeEach(async () => {
    await db.delete(applications);
    await db.delete(notifications);
    await db.delete(digestRuns);
    resetDigestScheduleForTests();
  });

  afterEach(() => {
    resetDigestScheduleForTests();
  });

  it("does nothing before the week's send time", async () => {
    const researcher = await createResearcher();
    const opportunity = await createOpportunity(researcher.id);
    await createApplication(opportunity.id, (await createStudent()).id, {
      status: "submitted",
      submittedAt: new Date(),
    });

    maybeRunWeeklyDigest(new Date("2026-09-07T09:00:00Z"));
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(await db.select().from(digestRuns)).toHaveLength(0);
  });

  it("sends once when the week is due", async () => {
    const researcher = await createResearcher();
    const opportunity = await createOpportunity(researcher.id);
    await createApplication(opportunity.id, (await createStudent()).id, {
      status: "submitted",
      submittedAt: new Date(),
    });

    maybeRunWeeklyDigest(new Date("2026-09-07T13:30:00Z"));
    const runs = await settle();

    expect(runs).toHaveLength(1);
    expect(runs[0].periodKey).toBe("2026-W37");
    expect(runs[0].researchersNotified).toBe(1);
  });

  it("ignores a flood of heartbeats, so a hammered health check costs nothing", async () => {
    const researcher = await createResearcher();
    const opportunity = await createOpportunity(researcher.id);
    await createApplication(opportunity.id, (await createStudent()).id, {
      status: "submitted",
      submittedAt: new Date(),
    });

    const when = new Date("2026-09-07T13:30:00Z");
    for (let attempt = 0; attempt < 25; attempt += 1) maybeRunWeeklyDigest(when);
    await settle();

    const notices = await db.select().from(notifications).where(eq(notifications.type, "weekly_digest"));
    expect(notices).toHaveLength(1);
  });

  it("will not send a week that has already gone out", async () => {
    await db.insert(digestRuns).values({
      periodKey: "2026-W37",
      startedAt: new Date("2026-09-07T13:00:00Z"),
      completedAt: new Date("2026-09-07T13:01:00Z"),
      researchersNotified: 3,
    });

    const researcher = await createResearcher();
    const opportunity = await createOpportunity(researcher.id);
    await createApplication(opportunity.id, (await createStudent()).id, {
      status: "submitted",
      submittedAt: new Date(),
    });

    maybeRunWeeklyDigest(new Date("2026-09-09T13:30:00Z"));
    await new Promise((resolve) => setTimeout(resolve, 100));

    const notices = await db.select().from(notifications).where(eq(notifications.type, "weekly_digest"));
    expect(notices).toHaveLength(0);
  });
});
