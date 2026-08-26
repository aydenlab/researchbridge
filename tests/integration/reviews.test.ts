import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { applications, db, placementOutcomes, placementReviews } from "@/db";
import { canReview, listReviewablePlacements, listReviewsFor, reviewSummary } from "@/lib/queries/reviews";
import { createApplicationGraph, createStudent } from "../fixtures";

async function accept(applicationId: string) {
  await db.update(applications).set({ status: "accepted" }).where(eq(applications.id, applicationId));
}

async function saveReview(input: {
  applicationId: string;
  direction: "researcher_to_student" | "student_to_researcher";
  authorId: string;
  subjectId: string;
  rating: number;
}) {
  await db.insert(placementReviews).values(input);
}

describe("who may review whom", () => {
  it("refuses a review when the application was merely submitted", async () => {
    const graph = await createApplicationGraph();

    const asStudent = await canReview({
      applicationId: graph.application.id,
      authorId: graph.student.id,
      direction: "student_to_researcher",
    });
    expect(asStudent.ok).toBe(false);

    const asResearcher = await canReview({
      applicationId: graph.application.id,
      authorId: graph.researcher.id,
      direction: "researcher_to_student",
    });
    expect(asResearcher.ok).toBe(false);
  });

  it("refuses a rejected applicant, so nobody can rate the person who declined them", async () => {
    const graph = await createApplicationGraph();
    await db.update(applications).set({ status: "declined" }).where(eq(applications.id, graph.application.id));

    const verdict = await canReview({
      applicationId: graph.application.id,
      authorId: graph.student.id,
      direction: "student_to_researcher",
    });
    expect(verdict.ok).toBe(false);
  });

  it("allows both sides once the application is accepted", async () => {
    const graph = await createApplicationGraph();
    await accept(graph.application.id);

    const student = await canReview({
      applicationId: graph.application.id,
      authorId: graph.student.id,
      direction: "student_to_researcher",
    });
    const researcher = await canReview({
      applicationId: graph.application.id,
      authorId: graph.researcher.id,
      direction: "researcher_to_student",
    });

    expect(student.ok).toBe(true);
    if (student.ok) expect(student.subjectId).toBe(graph.researcher.id);
    expect(researcher.ok).toBe(true);
    if (researcher.ok) expect(researcher.subjectId).toBe(graph.student.id);
  });

  it("also allows it when a placement was reported rather than accepted in app", async () => {
    const graph = await createApplicationGraph();
    await db.insert(placementOutcomes).values({
      applicationId: graph.application.id,
      studentReportedOutcome: "yes",
      confirmed: false,
    });

    const verdict = await canReview({
      applicationId: graph.application.id,
      authorId: graph.student.id,
      direction: "student_to_researcher",
    });
    expect(verdict.ok).toBe(true);
  });

  it("refuses somebody who was not part of the placement at all", async () => {
    const graph = await createApplicationGraph();
    const stranger = await createStudent();
    await accept(graph.application.id);

    const verdict = await canReview({
      applicationId: graph.application.id,
      authorId: stranger.id,
      direction: "student_to_researcher",
    });
    expect(verdict.ok).toBe(false);
  });

  it("refuses a side claiming the wrong direction", async () => {
    const graph = await createApplicationGraph();
    await accept(graph.application.id);

    // The student trying to file the researcher's review of them.
    const verdict = await canReview({
      applicationId: graph.application.id,
      authorId: graph.student.id,
      direction: "researcher_to_student",
    });
    expect(verdict.ok).toBe(false);
  });
});

describe("reviewable placements", () => {
  it("lists nothing until a placement qualifies", async () => {
    const graph = await createApplicationGraph();
    expect(await listReviewablePlacements(graph.student.id, "student")).toHaveLength(0);

    await accept(graph.application.id);
    const placements = await listReviewablePlacements(graph.student.id, "student");
    expect(placements).toHaveLength(1);
    expect(placements[0].counterpartId).toBe(graph.researcher.id);
    expect(placements[0].direction).toBe("student_to_researcher");
  });

  it("points a researcher at the student, and vice versa", async () => {
    const graph = await createApplicationGraph();
    await accept(graph.application.id);

    const forResearcher = await listReviewablePlacements(graph.researcher.id, "researcher");
    expect(forResearcher[0].counterpartId).toBe(graph.student.id);
    expect(forResearcher[0].direction).toBe("researcher_to_student");
  });

  it("returns nothing for an account with no role", async () => {
    const graph = await createApplicationGraph();
    await accept(graph.application.id);
    expect(await listReviewablePlacements(graph.student.id, null)).toHaveLength(0);
  });
});

describe("stored reviews", () => {
  it("keeps one review per side per placement", async () => {
    const graph = await createApplicationGraph();
    await accept(graph.application.id);

    await saveReview({
      applicationId: graph.application.id,
      direction: "student_to_researcher",
      authorId: graph.student.id,
      subjectId: graph.researcher.id,
      rating: 5,
    });

    await expect(
      saveReview({
        applicationId: graph.application.id,
        direction: "student_to_researcher",
        authorId: graph.student.id,
        subjectId: graph.researcher.id,
        rating: 3,
      }),
    ).rejects.toThrow();

    // The opposite direction on the same placement is a different review.
    await expect(
      saveReview({
        applicationId: graph.application.id,
        direction: "researcher_to_student",
        authorId: graph.researcher.id,
        subjectId: graph.student.id,
        rating: 4,
      }),
    ).resolves.toBeUndefined();
  });

  it("rejects a rating outside one to five", async () => {
    const graph = await createApplicationGraph();
    await accept(graph.application.id);
    await expect(
      saveReview({
        applicationId: graph.application.id,
        direction: "student_to_researcher",
        authorId: graph.student.id,
        subjectId: graph.researcher.id,
        rating: 6,
      }),
    ).rejects.toThrow();
  });

  it("rejects reviewing yourself at the database level", async () => {
    const graph = await createApplicationGraph();
    await expect(
      saveReview({
        applicationId: graph.application.id,
        direction: "student_to_researcher",
        authorId: graph.student.id,
        subjectId: graph.student.id,
        rating: 5,
      }),
    ).rejects.toThrow();
  });

  it("averages ratings for a person", async () => {
    const first = await createApplicationGraph();
    const second = await createApplicationGraph();
    await accept(first.application.id);
    await accept(second.application.id);

    const subject = first.researcher.id;
    await saveReview({
      applicationId: first.application.id,
      direction: "student_to_researcher",
      authorId: first.student.id,
      subjectId: subject,
      rating: 5,
    });
    await saveReview({
      applicationId: second.application.id,
      direction: "student_to_researcher",
      authorId: second.student.id,
      subjectId: subject,
      rating: 3,
    });

    const summary = await reviewSummary(subject);
    expect(summary.count).toBe(2);
    expect(summary.average).toBeCloseTo(4, 5);
    expect(await listReviewsFor(subject)).toHaveLength(2);
  });

  it("reports no average for somebody never reviewed", async () => {
    const student = await createStudent();
    expect(await reviewSummary(student.id)).toEqual({ count: 0, average: null });
  });
});
