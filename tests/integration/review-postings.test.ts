import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { db, opportunityDurations, opportunityReviewTasks } from "@/db";
import { searchOpportunities } from "@/lib/queries/opportunities";
import { createOpportunity, createResearcher } from "../fixtures";

async function createReview(
  researcherId: string,
  overrides: { title?: string; authorshipOffered?: boolean; tasks?: ("screening" | "data_extraction" | "manuscript_writing" | "risk_of_bias")[] } = {},
) {
  const opportunity = await createOpportunity(researcherId, {
    kind: "review_project",
    title: overrides.title ?? `Scoping review ${randomUUID().slice(0, 6)}`,
    authorshipOffered: overrides.authorshipOffered ?? true,
    deadline: null,
    hoursPerWeekMin: null,
    hoursPerWeekMax: null,
    compensationType: "volunteer",
  });
  await db
    .insert(opportunityReviewTasks)
    .values((overrides.tasks ?? ["screening"]).map((task) => ({ opportunityId: opportunity.id, task })));
  return opportunity;
}

describe("review postings as a separate posting type", () => {
  it("keeps reviews out of the research position list", async () => {
    const researcher = await createResearcher();
    const position = await createOpportunity(researcher.id, { title: "A research position" });
    const review = await createReview(researcher.id, { title: "A review" });

    const positions = await searchOpportunities({ perPage: 100 });
    const ids = positions.items.map((item) => item.id);
    expect(ids).toContain(position.id);
    expect(ids).not.toContain(review.id);
  });

  it("returns reviews with their tasks and authorship when asked for them", async () => {
    const researcher = await createResearcher();
    const review = await createReview(researcher.id, {
      authorshipOffered: true,
      tasks: ["screening", "data_extraction"],
    });

    const results = await searchOpportunities({ kind: "review_project", perPage: 100 });
    const found = results.items.find((item) => item.id === review.id);
    expect(found).toBeDefined();
    expect(found?.authorshipOffered).toBe(true);
    expect([...(found?.reviewTasks ?? [])].sort()).toEqual(["data_extraction", "screening"]);
  });

  it("filters reviews down to a single task", async () => {
    const researcher = await createResearcher();
    const screening = await createReview(researcher.id, { tasks: ["screening"] });
    const writing = await createReview(researcher.id, { tasks: ["manuscript_writing"] });

    const results = await searchOpportunities({ kind: "review_project", reviewTasks: ["manuscript_writing"], perPage: 100 });
    const ids = results.items.map((item) => item.id);
    expect(ids).toContain(writing.id);
    expect(ids).not.toContain(screening.id);
  });

  it("filters to the reviews that actually offer authorship", async () => {
    const researcher = await createResearcher();
    const withAuthorship = await createReview(researcher.id, { authorshipOffered: true });
    const without = await createReview(researcher.id, { authorshipOffered: false });

    const results = await searchOpportunities({ kind: "review_project", authorshipOnly: true, perPage: 100 });
    const ids = results.items.map((item) => item.id);
    expect(ids).toContain(withAuthorship.id);
    expect(ids).not.toContain(without.id);
  });

  it("survives having no deadline or hours, which a review never has", async () => {
    const researcher = await createResearcher();
    const review = await createReview(researcher.id);

    const results = await searchOpportunities({ kind: "review_project", openOnly: true, perPage: 100 });
    expect(results.items.map((item) => item.id)).toContain(review.id);
  });
});

describe("durations on a listing", () => {
  it("filters positions down to the lengths a student would accept", async () => {
    const researcher = await createResearcher();
    const short = await createOpportunity(researcher.id, { title: "Short project" });
    const long = await createOpportunity(researcher.id, { title: "Long project" });

    await db.insert(opportunityDurations).values([
      { opportunityId: short.id, duration: "one_semester" },
      { opportunityId: long.id, duration: "multi_year" },
    ]);

    const results = await searchOpportunities({ durations: ["one_semester"], perPage: 100 });
    const ids = results.items.map((item) => item.id);
    expect(ids).toContain(short.id);
    expect(ids).not.toContain(long.id);
  });

  it("matches a position that is open to several lengths on any one of them", async () => {
    const researcher = await createResearcher();
    const flexible = await createOpportunity(researcher.id, { title: "Flexible project" });
    await db.insert(opportunityDurations).values([
      { opportunityId: flexible.id, duration: "one_semester" },
      { opportunityId: flexible.id, duration: "one_year" },
    ]);

    for (const duration of ["one_semester", "one_year"]) {
      const results = await searchOpportunities({ durations: [duration], perPage: 100 });
      expect(results.items.map((item) => item.id)).toContain(flexible.id);
    }
  });
});
