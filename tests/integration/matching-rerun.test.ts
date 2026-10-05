import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { aiAnalyses, applicationSnapshots, db, opportunityCriteria } from "@/db";

/**
 * The model call is replaced: "ok" records a successful analysis under the
 * hash it was given, the way the real one does, and anything else is returned
 * as that failure.
 */
let behaviour: "ok" | "budget_exceeded" = "ok";
let calls = 0;
vi.mock("@/lib/ai/application-analysis", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai/application-analysis")>();
  return {
    ...actual,
    runApplicationAnalysis: async (input: Parameters<typeof actual.runApplicationAnalysis>[0]) => {
      calls += 1;
      if (behaviour !== "ok") return { state: "unavailable" as const, reason: behaviour };
      const semantic = input.criteria.filter((criterion) => ["technique", "written_response", "custom", "research_interest"].includes(criterion.type));
      const inputHash = actual.analysisInputHash({ ...input, criteria: semantic });
      await db.insert(aiAnalyses).values({
        applicationId: input.applicationId,
        type: actual.ANALYSIS_TYPE,
        model: "test-model",
        promptVersion: "test",
        schemaVersion: "test",
        inputHash,
        status: "ok",
        result: { criteria: [], responseSummaries: [], missingInformation: [], warnings: [] },
      });
      return {
        state: "ready" as const,
        analysis: { criteria: [], responseSummaries: [], missingInformation: [], warnings: [] },
        model: "test-model",
        createdAt: new Date(),
      };
    },
  };
});

const { rerunApplicationAnalyses } = await import("@/lib/criteria/rerun");
const { addCriterion, createApplication, createOpportunity, createResearcher, createStudent } = await import("../fixtures");

async function submittedApplication() {
  const researcher = await createResearcher();
  const opportunity = await createOpportunity(researcher.id);
  const criterion = await addCriterion(opportunity.id, {
    type: "custom",
    label: "Extracurricular involvement",
    required: false,
    importance: "low",
    config: {},
  });
  const student = await createStudent();
  const application = await createApplication(opportunity.id, student.id, { status: "submitted", submittedAt: new Date() });
  await db.insert(applicationSnapshots).values({
    applicationId: application.id,
    profile: { skills: [], courses: [], yearLevel: 2 },
  });
  return { application, criterion };
}

beforeEach(() => {
  behaviour = "ok";
  calls = 0;
});

describe("re-running written-response analysis", () => {
  it("re-runs an application whose inputs changed, and skips it once it is current", async () => {
    const { application } = await submittedApplication();

    const first = await rerunApplicationAnalyses();
    expect(first.rerun).toBeGreaterThanOrEqual(1);
    const callsAfterFirst = calls;

    const second = await rerunApplicationAnalyses();
    expect(second.stale).toBe(0);
    expect(calls).toBe(callsAfterFirst);

    const rows = await db.select().from(aiAnalyses).where(eq(aiAnalyses.applicationId, application.id));
    expect(rows).toHaveLength(1);
  });

  it("re-runs again when the researcher edits a criterion", async () => {
    const { criterion } = await submittedApplication();
    await rerunApplicationAnalyses();
    await db.update(opportunityCriteria).set({ label: "Leadership outside class" }).where(eq(opportunityCriteria.id, criterion.id));

    const after = await rerunApplicationAnalyses();
    expect(after.stale).toBe(1);
    expect(after.rerun).toBe(1);
  });

  it("stops at an exhausted budget instead of trying every application", async () => {
    await submittedApplication();
    await submittedApplication();
    behaviour = "budget_exceeded";
    const result = await rerunApplicationAnalyses();
    expect(result.stopped).toBe("budget_exceeded");
    expect(calls).toBe(1);
  });
});
