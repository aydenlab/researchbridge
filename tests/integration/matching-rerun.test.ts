import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { aiAnalyses, applicationSnapshots, criterionEvaluations, db, opportunities, opportunityCriteria } from "@/db";

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

let signedIn: { id: string } | null = null;
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw Object.assign(new Error(`REDIRECT:${url}`), { digest: `NEXT_REDIRECT;${url}` });
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/auth/permissions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/permissions")>();
  return {
    ...actual,
    requireManagedOpportunity: async (opportunityId: string) => {
      const [opportunity] = await db.select().from(opportunities).where(eq(opportunities.id, opportunityId)).limit(1);
      return { user: signedIn, opportunity };
    },
  };
});

const { matchingHealth, rerunApplicationAnalyses } = await import("@/lib/criteria/rerun");
const { rescoreDeterministicCriteria } = await import("@/lib/criteria/rescore");
const { saveCriteriaStepAction } = await import("@/app/(app)/researcher/opportunities/actions");
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

describe("keeping every applicant graded", () => {
  it("re-grades existing applicants when a researcher replaces a posting's criteria", async () => {
    const { application } = await submittedApplication();
    const opportunityId = application.opportunityId;
    signedIn = { id: "researcher" };

    const form = new FormData();
    form.set("opportunityId", opportunityId);
    form.append("criterionType", "year_level");
    form.append("criterionLabel", "Year 2 or above");
    form.append("criterionDescription", "");
    form.append("criterionImportance", "required");
    form.append("criterionConfig", "2");
    await saveCriteriaStepAction(null, form).catch((error: Error) => {
      if (!error.message.startsWith("REDIRECT:")) throw error;
    });

    // The regrade runs after the response; outside a request it runs at once.
    let stored: { status: string }[] = [];
    for (let attempt = 0; attempt < 40 && stored.length === 0; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      stored = await db
        .select({ status: criterionEvaluations.status })
        .from(criterionEvaluations)
        .where(eq(criterionEvaluations.applicationId, application.id));
    }
    expect(stored.map((entry) => entry.status)).toEqual(["met"]);
  });

  it("reports ungraded applications until they are graded", async () => {
    const researcher = await createResearcher();
    const opportunity = await createOpportunity(researcher.id);
    await addCriterion(opportunity.id, { type: "year_level", label: "Year 2+", config: { minYear: 2 } });
    const student = await createStudent();
    const application = await createApplication(opportunity.id, student.id, { status: "submitted", submittedAt: new Date() });
    await db.insert(applicationSnapshots).values({ applicationId: application.id, profile: { skills: [], courses: [], yearLevel: 3 } });

    expect((await matchingHealth()).ungradedApplications).toBeGreaterThanOrEqual(1);
    await rescoreDeterministicCriteria({ opportunityId: opportunity.id });
    const after = await matchingHealth();
    expect(after.fitFailures).toBe(0);
    expect(after.fitsComputed).toBeGreaterThanOrEqual(1);

    await rescoreDeterministicCriteria();
    expect((await matchingHealth()).ungradedApplications).toBe(0);
  });
});
