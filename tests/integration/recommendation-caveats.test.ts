import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  db,
  opportunityDurations,
  opportunityFields,
  researchFields,
  studentDurations,
  studentResearchInterests,
} from "@/db";
import { recommendOpportunities } from "@/lib/queries/recommendations";
import { loadStudentProfile } from "@/lib/queries/student";
import { createOpportunity, createResearcher, createStudent } from "../fixtures";

async function fieldId(name: string) {
  const rows = await db
    .select({ id: researchFields.id })
    .from(researchFields)
    .where(eq(researchFields.name, name))
    .limit(1);
  return rows[0]?.id ?? null;
}

describe("what a recommendation tells the student", () => {
  it("carries the mismatched dimensions through as caveats", async () => {
    const cardiology = await fieldId("Cardiology");
    if (!cardiology) throw new Error("Expected the seeded taxonomy to contain Cardiology.");

    const researcher = await createResearcher();
    const student = await createStudent();

    // The student wants a single term; the listing runs for years.
    await db.insert(studentDurations).values({ studentId: student.id, duration: "one_semester" });
    await db.insert(studentResearchInterests).values({ studentId: student.id, researchFieldId: cardiology });

    const opportunity = await createOpportunity(researcher.id, { compensationType: "volunteer" });
    await db.insert(opportunityDurations).values({ opportunityId: opportunity.id, duration: "multi_year" });
    await db.insert(opportunityFields).values({ opportunityId: opportunity.id, researchFieldId: cardiology });

    const bundle = await loadStudentProfile(student.id);
    expect(bundle).not.toBeNull();
    if (!bundle) return;

    const recommendations = await recommendOpportunities(bundle, { limit: 50 });
    const mine = recommendations.find((entry) => entry.item.id === opportunity.id);

    expect(mine).toBeDefined();
    expect(mine?.caveats.join(" ")).toContain("different length");
    // The shared interest still earns it a place, so this is a caveat rather
    // than a reason to hide the listing.
    expect(mine?.reasons.join(" ")).toContain("Cardiology");
  });

  it("leaves caveats empty when every dimension that applied matched", async () => {
    const cardiology = await fieldId("Cardiology");
    if (!cardiology) throw new Error("Expected the seeded taxonomy to contain Cardiology.");

    const researcher = await createResearcher();
    const student = await createStudent();

    await db.insert(studentDurations).values({ studentId: student.id, duration: "one_semester" });
    await db.insert(studentResearchInterests).values({ studentId: student.id, researchFieldId: cardiology });

    const opportunity = await createOpportunity(researcher.id, { compensationType: "academic_credit" });
    await db.insert(opportunityDurations).values({ opportunityId: opportunity.id, duration: "one_semester" });
    await db.insert(opportunityFields).values({ opportunityId: opportunity.id, researchFieldId: cardiology });

    const bundle = await loadStudentProfile(student.id);
    if (!bundle) return;

    const recommendations = await recommendOpportunities(bundle, { limit: 50 });
    const mine = recommendations.find((entry) => entry.item.id === opportunity.id);

    expect(mine).toBeDefined();
    expect(mine?.caveats).toEqual([]);
  });
});
