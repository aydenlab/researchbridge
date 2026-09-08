import { describe, expect, it } from "vitest";
import { db, opportunityDurations, opportunityFields, researchFields, studentDurations, studentResearchInterests } from "@/db";
import { eq } from "drizzle-orm";
import { loadOpportunityMatchInput, scoreCandidatesAgainst } from "@/lib/queries/recommendations";
import { createOpportunity, createResearcher, createStudent } from "../fixtures";

async function anyField(name: string) {
  const rows = await db.select({ id: researchFields.id }).from(researchFields).where(eq(researchFields.name, name)).limit(1);
  return rows[0]?.id ?? null;
}

describe("scoring students against a researcher's own position", () => {
  it("reads the listing back in the shape matching expects", async () => {
    const researcher = await createResearcher();
    const opportunity = await createOpportunity(researcher.id, {
      compensationType: "paid",
      academicCreditAvailable: true,
      hoursPerWeekMin: 8,
      locationMode: "remote",
    });
    await db.insert(opportunityDurations).values({ opportunityId: opportunity.id, duration: "one_year" });

    const input = await loadOpportunityMatchInput(opportunity.id);
    expect(input).not.toBeNull();
    expect(input?.durations).toEqual(["one_year"]);
    expect(input?.compensationType).toBe("paid");
    expect(input?.academicCreditAvailable).toBe(true);
    expect(input?.hoursPerWeekMin).toBe(8);
    expect(input?.locationMode).toBe("remote");
  });

  it("returns nothing for a listing that does not exist", async () => {
    expect(await loadOpportunityMatchInput("00000000-0000-0000-0000-000000000000")).toBeNull();
  });

  it("ranks a student whose duration overlaps above one whose does not", async () => {
    const researcher = await createResearcher();
    const opportunity = await createOpportunity(researcher.id);
    await db.insert(opportunityDurations).values({ opportunityId: opportunity.id, duration: "one_semester" });

    const overlapping = await createStudent();
    const mismatched = await createStudent();
    await db.insert(studentDurations).values({ studentId: overlapping.id, duration: "one_semester" });
    await db.insert(studentDurations).values({ studentId: mismatched.id, duration: "multi_year" });

    const scores = await scoreCandidatesAgainst(opportunity.id, [overlapping.id, mismatched.id]);
    const good = scores.get(overlapping.id);
    const bad = scores.get(mismatched.id);

    expect(good?.points).toBeGreaterThan(bad?.points ?? 0);
    expect(bad?.caveats.join(" ")).toContain("different length");
  });

  it("only scores the students it was asked about", async () => {
    const researcher = await createResearcher();
    const opportunity = await createOpportunity(researcher.id);
    const asked = await createStudent();
    const other = await createStudent();

    const scores = await scoreCandidatesAgainst(opportunity.id, [asked.id]);
    expect(scores.has(asked.id)).toBe(true);
    expect(scores.has(other.id)).toBe(false);
  });

  it("scores nobody when given an empty list rather than everybody", async () => {
    const researcher = await createResearcher();
    const opportunity = await createOpportunity(researcher.id);

    const scores = await scoreCandidatesAgainst(opportunity.id, []);
    expect(scores.size).toBe(0);
  });

  it("credits a shared research interest", async () => {
    const fieldId = await anyField("Cardiology");
    if (!fieldId) return;

    const researcher = await createResearcher();
    const opportunity = await createOpportunity(researcher.id);
    await db.insert(opportunityFields).values({ opportunityId: opportunity.id, researchFieldId: fieldId });

    const aligned = await createStudent();
    const unaligned = await createStudent();
    await db.insert(studentResearchInterests).values({ studentId: aligned.id, researchFieldId: fieldId });

    const scores = await scoreCandidatesAgainst(opportunity.id, [aligned.id, unaligned.id]);
    expect(scores.get(aligned.id)?.points).toBeGreaterThan(scores.get(unaligned.id)?.points ?? 0);
    expect(scores.get(aligned.id)?.reasons.join(" ")).toContain("Cardiology");
  });
});
