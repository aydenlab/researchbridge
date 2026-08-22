import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db, aiAnalyses, aiRateLimits, aiResponseCache, aiUsageEvents } from "@/db";
import type { ApplicantEvidence, Criterion } from "@/lib/criteria/types";
import { createApplicationGraph } from "../fixtures";

const createMock = vi.fn();

vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create: createMock };
  },
}));

type TextBlock = { type: string; text: string; cache_control?: { type: string } };

const criteria: Criterion[] = [
  {
    id: "criterion_123",
    type: "written_response",
    label: "Understanding of the attached paper",
    description: null,
    required: false,
    importance: "high",
    config: {},
    sortOrder: 0,
  },
];

const evidence: ApplicantEvidence = {
  program: "Bachelor of Health Sciences",
  faculty: null,
  degreeLevel: "undergraduate",
  yearLevel: 2,
  graduationYear: 2028,
  weeklyHours: 10,
  locationPreference: "hybrid",
  desiredStartDate: null,
  semesters: [],
  summerAvailable: null,
  skills: [{ name: "Python", slug: "python", proficiency: "working", context: null }],
  courses: [],
  researchFields: [],
  experiences: [],
  academicRecords: [],
  answers: [
    {
      questionId: "q1",
      prompt: "What interests you about clinical outcomes research?",
      text: "I used Python and pandas to clean longitudinal clinical data for a reading group.",
    },
  ],
};

function toolResponse(usage: Record<string, number> = {}) {
  return {
    model: "claude-sonnet-5",
    usage: { input_tokens: 900, output_tokens: 210, ...usage },
    content: [
      {
        type: "tool_use",
        name: "report_criterion_evidence",
        input: {
          criteria: [
            {
              criterionId: "criterion_123",
              assessment: "strong_evidence",
              evidence: ["Student describes cleaning longitudinal clinical data."],
              reasoningSummary: "The described project demonstrates relevant data-cleaning work.",
            },
          ],
          responseSummaries: [],
          missingInformation: [],
          warnings: [],
        },
      },
    ],
  };
}

function alignmentResponse() {
  return {
    model: "claude-sonnet-5",
    usage: { input_tokens: 400, output_tokens: 90 },
    content: [
      {
        type: "tool_use",
        name: "report_alignment",
        input: { overlaps: [{ label: "Python", reason: "Both mention Python." }], gaps: [] },
      },
    ],
  };
}

const alignmentInput = {
  projectTitle: "Cardiovascular Outcomes",
  projectSummary: "Analyze retrospective clinical data.",
  requestedSkills: ["Python"],
  requestedCoursework: [],
  researchFields: ["Clinical research"],
  studentSkills: ["Python"],
  studentCoursework: [],
  studentFields: [],
  studentSummary: null,
};

const BASE_ENV = {
  AI_MAX_CALLS_PER_MINUTE: "50",
  AI_MAX_CALLS_PER_DAY: "500",
  AI_MAX_CALLS_PER_SUBJECT_PER_HOUR: "5",
  AI_DAILY_BUDGET_USD: "5",
  AI_MONTHLY_BUDGET_USD: "50",
  ANTHROPIC_PROMPT_CACHE_ENABLED: "true",
  AI_MAX_SECTION_CHARS: "8000",
  AI_MAX_INPUT_CHARS: "24000",
  AI_BREAKER_FAILURE_THRESHOLD: "4",
  AI_NEGATIVE_CACHE_TTL_MINUTES: "30",
};

type AiModules = {
  analysis: typeof import("@/lib/ai/application-analysis");
  alignment: typeof import("@/lib/ai/research-interest-analysis");
  breaker: typeof import("@/lib/ai/circuit-breaker");
  spend: typeof import("@/lib/ai/spend");
  pricing: typeof import("@/lib/ai/pricing");
};

let mods: AiModules;

/** Reloads the AI modules so a changed limit is picked up by the env snapshot. */
async function reload(overrides: Record<string, string> = {}): Promise<AiModules> {
  vi.resetModules();
  for (const [key, value] of Object.entries({ ...BASE_ENV, ...overrides })) process.env[key] = value;
  process.env.ANTHROPIC_API_KEY = "test-key";

  mods = {
    analysis: await import("@/lib/ai/application-analysis"),
    alignment: await import("@/lib/ai/research-interest-analysis"),
    breaker: await import("@/lib/ai/circuit-breaker"),
    spend: await import("@/lib/ai/spend"),
    pricing: await import("@/lib/ai/pricing"),
  };
  mods.breaker.resetBreakers();
  (await import("@/lib/ai/single-flight")).resetSingleFlight();
  return mods;
}

beforeEach(async () => {
  createMock.mockReset();
  await db.delete(aiRateLimits);
  await db.delete(aiUsageEvents);
  await db.delete(aiResponseCache);
  await reload();
});

afterEach(() => {
  for (const key of Object.keys(BASE_ENV)) delete process.env[key];
  delete process.env.ANTHROPIC_API_KEY;
});

async function freshApplicationId(): Promise<string> {
  return (await createApplicationGraph()).application.id;
}

function runAnalysis(applicationId: string, overrides: Record<string, unknown> = {}) {
  return mods.analysis.runApplicationAnalysis({
    applicationId,
    criteria,
    evidence,
    projectTitle: "Cardiovascular Outcomes",
    projectSummary: "Analyze retrospective clinical data.",
    isPaidPosition: false,
    force: true,
    ...overrides,
  });
}

function lastCall(index = 0) {
  const call = createMock.mock.calls[index][0];
  return { system: call.system as TextBlock[], content: call.messages[0].content as TextBlock[] };
}

describe("prompt caching", () => {
  it("marks the system block and the shared project block, but not the applicant block", async () => {
    createMock.mockResolvedValue(toolResponse());
    await runAnalysis(await freshApplicationId());

    const { system, content } = lastCall();
    expect(system[0].cache_control).toEqual({ type: "ephemeral" });
    expect(content).toHaveLength(2);
    expect(content[0].cache_control).toEqual({ type: "ephemeral" });
    expect(content[1].cache_control).toBeUndefined();
  });

  it("puts the project and criteria in the cached block and the applicant in the volatile one", async () => {
    createMock.mockResolvedValue(toolResponse());
    await runAnalysis(await freshApplicationId());

    const { content } = lastCall();
    expect(content[0].text).toContain("Project title: Cardiovascular Outcomes");
    expect(content[0].text).toContain("criterionId: criterion_123");
    expect(content[0].text).not.toContain("applicant_material");
    expect(content[1].text).toContain("<applicant_material");
    expect(content[1].text).toContain("pandas");
  });

  it("sends a byte-identical cached prefix for two applicants on the same project", async () => {
    createMock.mockResolvedValue(toolResponse());
    await runAnalysis(await freshApplicationId());
    await runAnalysis(await freshApplicationId(), { evidence: { ...evidence, program: "Engineering" } });

    expect(lastCall(1).content[0].text).toBe(lastCall(0).content[0].text);
    expect(lastCall(1).content[1].text).not.toBe(lastCall(0).content[1].text);
  });

  it("omits cache markers when prompt caching is switched off", async () => {
    await reload({ ANTHROPIC_PROMPT_CACHE_ENABLED: "false" });
    createMock.mockResolvedValue(toolResponse());
    await runAnalysis(await freshApplicationId());

    const { system, content } = lastCall();
    expect(system[0].cache_control).toBeUndefined();
    expect(content[0].cache_control).toBeUndefined();
  });
});

describe("cost accounting", () => {
  it("prices cache reads far below fresh input, and cache writes above it", () => {
    const usage = { inputTokens: 0, outputTokens: 0 };
    expect(mods.pricing.estimateCostUsd("claude-sonnet-5", { ...usage, inputTokens: 10_000 })).toBeCloseTo(0.03, 6);
    expect(mods.pricing.estimateCostUsd("claude-sonnet-5", { ...usage, cacheReadInputTokens: 10_000 })).toBeCloseTo(0.003, 6);
    expect(mods.pricing.estimateCostUsd("claude-sonnet-5", { ...usage, cacheCreationInputTokens: 10_000 })).toBeCloseTo(0.0375, 6);
  });

  it("falls back to Opus list prices for a model it does not know", () => {
    expect(mods.pricing.estimateCostUsd("some-unreleased-model", { inputTokens: 1_000_000, outputTokens: 0 })).toBeCloseTo(5, 6);
    expect(mods.pricing.isPricedModel("some-unreleased-model")).toBe(false);
    expect(mods.pricing.isPricedModel("claude-sonnet-5")).toBe(true);
  });

  it("records every token class and reports a cache hit rate", async () => {
    createMock.mockResolvedValue(
      toolResponse({ input_tokens: 100, cache_creation_input_tokens: 0, cache_read_input_tokens: 900 }),
    );
    await runAnalysis(await freshApplicationId());

    const [event] = await db.select().from(aiUsageEvents);
    expect(event.outcome).toBe("ok");
    expect(event.inputTokens).toBe(100);
    expect(event.cacheReadInputTokens).toBe(900);
    expect(Number(event.costUsd)).toBeGreaterThan(0);

    const summary = await mods.spend.spendSummary();
    expect(summary.cacheHitRate).toBeCloseTo(0.9, 3);
    expect(summary.callsThisMonth).toBe(1);
    expect(summary.dayUsd).toBeGreaterThan(0);
    expect(summary.exceeded).toBe(false);
  });
});

describe("budget cap", () => {
  it("stops calling the provider once the daily budget is spent", async () => {
    await reload({ AI_DAILY_BUDGET_USD: "0.001" });
    createMock.mockResolvedValue(toolResponse());

    expect((await runAnalysis(await freshApplicationId())).state).toBe("ready");
    expect(createMock).toHaveBeenCalledTimes(1);

    const second = await runAnalysis(await freshApplicationId());
    expect(second.state).toBe("unavailable");
    if (second.state !== "unavailable") return;
    expect(second.reason).toBe("budget_exceeded");
    expect(createMock).toHaveBeenCalledTimes(1);
  });
});

describe("rejected key", () => {
  it("names a rejected key instead of reporting a provider outage", async () => {
    createMock.mockRejectedValue(Object.assign(new Error("API key is invalid."), { status: 401 }));
    const result = await runAnalysis(await freshApplicationId());

    expect(result.state).toBe("unavailable");
    if (result.state !== "unavailable") return;
    expect(result.reason).toBe("invalid_api_key");

    const summary = await mods.spend.spendSummary();
    expect(summary.recentFailure).toBe("invalid_api_key");
  });

  it("still lets the application submit and the deterministic criteria stand", async () => {
    createMock.mockRejectedValue(Object.assign(new Error("forbidden"), { status: 403 }));
    const result = await runAnalysis(await freshApplicationId());

    expect(result.state).toBe("unavailable");
    if (result.state !== "unavailable") return;
    expect(result.reason).toBe("invalid_api_key");
  });
});

describe("rate limiting", () => {
  it("caps how often one application can be re-analysed", async () => {
    await reload({ AI_MAX_CALLS_PER_SUBJECT_PER_HOUR: "2" });
    createMock.mockResolvedValue(toolResponse());

    const applicationId = await freshApplicationId();
    expect((await runAnalysis(applicationId)).state).toBe("ready");
    expect((await runAnalysis(applicationId)).state).toBe("ready");

    const third = await runAnalysis(applicationId);
    expect(third.state).toBe("unavailable");
    if (third.state !== "unavailable") return;
    expect(third.reason).toBe("throttled");
    expect(createMock).toHaveBeenCalledTimes(2);
  });

  it("caps the whole deployment and does not consume a slot once over the limit", async () => {
    await reload({ AI_MAX_CALLS_PER_MINUTE: "1" });
    createMock.mockResolvedValue(toolResponse());

    expect((await runAnalysis(await freshApplicationId())).state).toBe("ready");
    const blocked = await runAnalysis(await freshApplicationId());
    await runAnalysis(await freshApplicationId());

    expect(blocked.state).toBe("unavailable");
    if (blocked.state !== "unavailable") return;
    expect(blocked.reason).toBe("throttled");

    const rows = await db.select().from(aiRateLimits);
    expect(rows.find((row) => row.bucket === "global:minute")?.count).toBe(1);
  });

  it("hands the slot back when the provider call itself fails", async () => {
    createMock.mockRejectedValue(Object.assign(new Error("boom"), { status: 500 }));
    await runAnalysis(await freshApplicationId());

    const rows = await db.select().from(aiRateLimits);
    expect(rows.find((row) => row.bucket === "global:minute")?.count).toBe(0);
  });
});

describe("circuit breaker", () => {
  it("stops calling the provider after a run of failures", async () => {
    await reload({ AI_BREAKER_FAILURE_THRESHOLD: "2" });
    createMock.mockRejectedValue(Object.assign(new Error("down"), { status: 503 }));

    await runAnalysis(await freshApplicationId());
    await runAnalysis(await freshApplicationId());
    const blocked = await runAnalysis(await freshApplicationId());

    expect(createMock).toHaveBeenCalledTimes(2);
    expect(blocked.state).toBe("unavailable");
    if (blocked.state !== "unavailable") return;
    expect(blocked.reason).toBe("provider_unavailable");
  });

  it("closes again after a call succeeds", async () => {
    createMock.mockRejectedValueOnce(Object.assign(new Error("down"), { status: 503 }));
    await runAnalysis(await freshApplicationId());
    expect(mods.breaker.breakerSnapshot()[0].failures).toBe(1);

    createMock.mockResolvedValue(toolResponse());
    await runAnalysis(await freshApplicationId());
    expect(mods.breaker.breakerSnapshot()[0]).toMatchObject({ failures: 0, open: false });
  });
});

describe("request collapsing", () => {
  it("serves two concurrent identical analyses from one provider call", async () => {
    const pendingCalls: Array<(value: unknown) => void> = [];
    createMock.mockImplementation(() => new Promise((resolve) => pendingCalls.push(resolve)));

    const applicationId = await freshApplicationId();
    const both = Promise.all([runAnalysis(applicationId, { force: false }), runAnalysis(applicationId, { force: false })]);

    await vi.waitFor(() => expect(pendingCalls).toHaveLength(1));
    pendingCalls[0](toolResponse());

    const [first, second] = await both;
    expect(createMock).toHaveBeenCalledTimes(1);
    expect(first.state).toBe("ready");
    expect(second.state).toBe("ready");
  });
});

describe("stored analysis reuse", () => {
  it("retries a stored transient failure once it has aged out", async () => {
    const applicationId = await freshApplicationId();
    createMock.mockRejectedValueOnce(Object.assign(new Error("boom"), { status: 500 }));
    expect((await runAnalysis(applicationId)).state).toBe("unavailable");

    createMock.mockResolvedValue(toolResponse());
    expect((await runAnalysis(applicationId, { force: false })).state).toBe("unavailable");
    expect(createMock).toHaveBeenCalledTimes(1);

    await db.update(aiAnalyses).set({ createdAt: new Date(Date.now() - 60 * 60 * 1000) });

    expect((await runAnalysis(applicationId, { force: false })).state).toBe("ready");
    expect(createMock).toHaveBeenCalledTimes(2);
  });

  it("keeps trusting a stored schema rejection, because the same input would fail again", async () => {
    const applicationId = await freshApplicationId();
    createMock.mockResolvedValue({
      model: "claude-sonnet-5",
      usage: { input_tokens: 10, output_tokens: 5 },
      content: [{ type: "tool_use", name: "report_criterion_evidence", input: { criteria: "nonsense" } }],
    });

    const failed = await runAnalysis(applicationId);
    expect(failed.state).toBe("unavailable");
    if (failed.state !== "unavailable") return;
    expect(failed.reason).toBe("invalid_output");

    await db.update(aiAnalyses).set({ createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000) });

    expect((await runAnalysis(applicationId, { force: false })).state).toBe("unavailable");
    expect(createMock).toHaveBeenCalledTimes(1);
  });
});

describe("input size guard", () => {
  it("trims an oversized answer, says so, and still closes the untrusted wrapper", async () => {
    createMock.mockResolvedValue(toolResponse());
    await runAnalysis(await freshApplicationId(), {
      evidence: { ...evidence, answers: [{ questionId: "q1", prompt: "Everything", text: "x".repeat(50_000) }] },
    });

    const applicantBlock = lastCall().content[1].text;
    expect(applicantBlock.length).toBeLessThan(12_000);
    expect(applicantBlock).toContain("shortened to fit the review budget");
    expect(applicantBlock).toContain("</applicant_material>");
  });
});

describe("student alignment cache", () => {
  it("answers a repeated view from the cache instead of the provider", async () => {
    createMock.mockResolvedValue(alignmentResponse());

    expect((await mods.alignment.analyzeInterestAlignment(alignmentInput)).state).toBe("ready");
    const second = await mods.alignment.analyzeInterestAlignment(alignmentInput);

    expect(createMock).toHaveBeenCalledTimes(1);
    expect(second.state).toBe("ready");
    if (second.state !== "ready") return;
    expect(second.alignment.overlaps[0].label).toBe("Python");

    const [cached] = await db.select().from(aiResponseCache);
    expect(cached.hits).toBeGreaterThanOrEqual(1);
  });

  it("calls again when the profile actually changed", async () => {
    createMock.mockResolvedValue(alignmentResponse());
    await mods.alignment.analyzeInterestAlignment(alignmentInput);
    await mods.alignment.analyzeInterestAlignment({ ...alignmentInput, studentSkills: ["R"] });

    expect(createMock).toHaveBeenCalledTimes(2);
  });

  it("hashes inputs by value, so key order does not split the cache", async () => {
    const { cacheKeyFor } = await import("@/lib/ai/response-cache");
    expect(cacheKeyFor("f", { a: 1, b: [2, 3] })).toBe(cacheKeyFor("f", { b: [2, 3], a: 1 }));
    expect(cacheKeyFor("f", { a: 1 })).not.toBe(cacheKeyFor("f", { a: 2 }));
  });

  it("holds a transient failure only briefly", async () => {
    createMock.mockRejectedValue(Object.assign(new Error("boom"), { status: 500 }));
    expect((await mods.alignment.analyzeInterestAlignment(alignmentInput)).state).toBe("unavailable");

    const [row] = await db.select().from(aiResponseCache);
    expect(row.status).toBe("error");
    expect(row.expiresAt.getTime() - row.createdAt.getTime()).toBeLessThanOrEqual(30 * 60 * 1000);
  });

  it("ignores an entry once it expires", async () => {
    const { writeResponseCache, readResponseCache } = await import("@/lib/ai/response-cache");
    await writeResponseCache({ cacheKey: "expired", feature: "test", model: null, ttlMs: -1, result: { gaps: [] } });

    expect(await readResponseCache("expired")).toBeNull();
    expect(await db.select().from(aiResponseCache)).toHaveLength(0);
  });
});
