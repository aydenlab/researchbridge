import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db, aiRateLimits, aiResponseCache, aiSpendDaily, aiUsageEvents } from "@/db";
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

const validPayload = {
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
};

function toolResponse(usage: Record<string, number> = {}) {
  return {
    model: "claude-sonnet-5",
    usage: { input_tokens: 900, output_tokens: 210, ...usage },
    content: [{ type: "tool_use", name: "report_criterion_evidence", input: validPayload }],
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

type AiModules = {
  analysis: typeof import("@/lib/ai/application-analysis");
  alignment: typeof import("@/lib/ai/research-interest-analysis");
  breaker: typeof import("@/lib/ai/circuit-breaker");
  singleFlight: typeof import("@/lib/ai/single-flight");
  rateLimit: typeof import("@/lib/ai/rate-limit");
  spend: typeof import("@/lib/ai/spend");
  pricing: typeof import("@/lib/ai/pricing");
};

async function loadModules(): Promise<AiModules> {
  return {
    analysis: await import("@/lib/ai/application-analysis"),
    alignment: await import("@/lib/ai/research-interest-analysis"),
    breaker: await import("@/lib/ai/circuit-breaker"),
    singleFlight: await import("@/lib/ai/single-flight"),
    rateLimit: await import("@/lib/ai/rate-limit"),
    spend: await import("@/lib/ai/spend"),
    pricing: await import("@/lib/ai/pricing"),
  };
}

async function clearCostTables() {
  await db.delete(aiRateLimits);
  await db.delete(aiUsageEvents);
  await db.delete(aiSpendDaily);
  await db.delete(aiResponseCache);
}

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

function applyEnv(overrides: Record<string, string> = {}) {
  for (const [key, value] of Object.entries({ ...BASE_ENV, ...overrides })) {
    process.env[key] = value;
  }
}

function clearEnv() {
  for (const key of Object.keys(BASE_ENV)) delete process.env[key];
  delete process.env.ANTHROPIC_API_KEY;
}

let mods: AiModules;

beforeEach(async () => {
  vi.resetModules();
  createMock.mockReset();
  await clearCostTables();
  applyEnv();
  process.env.ANTHROPIC_API_KEY = "test-key";
  mods = await loadModules();
  mods.breaker.resetBreakers();
  mods.singleFlight.resetSingleFlight();
});

afterEach(() => {
  clearEnv();
});

async function freshApplicationId(): Promise<string> {
  const graph = await createApplicationGraph();
  return graph.application.id;
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

describe("prompt caching", () => {
  it("marks the system block and the shared project block as cache breakpoints", async () => {
    createMock.mockResolvedValue(toolResponse());
    await runAnalysis(await freshApplicationId());

    const call = createMock.mock.calls[0][0];
    const system = call.system as TextBlock[];
    const content = call.messages[0].content as TextBlock[];

    expect(system[0].cache_control).toEqual({ type: "ephemeral" });
    expect(content).toHaveLength(2);
    expect(content[0].cache_control).toEqual({ type: "ephemeral" });
    expect(content[1].cache_control).toBeUndefined();
  });

  it("puts the project and criteria in the cached block and the applicant in the volatile one", async () => {
    createMock.mockResolvedValue(toolResponse());
    await runAnalysis(await freshApplicationId());

    const content = createMock.mock.calls[0][0].messages[0].content as TextBlock[];
    expect(content[0].text).toContain("Project title: Cardiovascular Outcomes");
    expect(content[0].text).toContain("criterionId: criterion_123");
    expect(content[0].text).not.toContain("applicant_material");
    expect(content[1].text).toContain("<applicant_material");
    expect(content[1].text).toContain("pandas");
  });

  it("sends a byte-identical cached prefix for two different applicants on the same project", async () => {
    createMock.mockResolvedValue(toolResponse());
    await runAnalysis(await freshApplicationId());
    await runAnalysis(await freshApplicationId(), {
      evidence: { ...evidence, program: "Bachelor of Engineering" },
    });

    const first = createMock.mock.calls[0][0].messages[0].content as TextBlock[];
    const second = createMock.mock.calls[1][0].messages[0].content as TextBlock[];
    expect(second[0].text).toBe(first[0].text);
    expect(second[1].text).not.toBe(first[1].text);
  });

  it("omits cache markers when prompt caching is switched off", async () => {
    vi.resetModules();
    applyEnv({ ANTHROPIC_PROMPT_CACHE_ENABLED: "false" });
    mods = await loadModules();
    createMock.mockResolvedValue(toolResponse());

    await runAnalysis(await freshApplicationId());

    const call = createMock.mock.calls[0][0];
    expect((call.system as TextBlock[])[0].cache_control).toBeUndefined();
    expect((call.messages[0].content as TextBlock[])[0].cache_control).toBeUndefined();
  });
});

describe("cost accounting", () => {
  it("prices cache reads far below fresh input tokens", () => {
    const fresh = mods.pricing.estimateCostUsd("claude-sonnet-5", { inputTokens: 10_000, outputTokens: 0 });
    const cached = mods.pricing.estimateCostUsd("claude-sonnet-5", {
      inputTokens: 0,
      outputTokens: 0,
      cacheReadInputTokens: 10_000,
    });

    expect(fresh).toBeCloseTo(0.03, 6);
    expect(cached).toBeCloseTo(0.003, 6);
    expect(cached).toBeLessThan(fresh);
  });

  it("charges a premium for writing a cache entry", () => {
    const write = mods.pricing.estimateCostUsd("claude-sonnet-5", {
      inputTokens: 0,
      outputTokens: 0,
      cacheCreationInputTokens: 10_000,
    });
    expect(write).toBeCloseTo(0.0375, 6);
  });

  it("falls back to Opus list prices for a model it does not know", () => {
    const cost = mods.pricing.estimateCostUsd("some-unreleased-model", { inputTokens: 1_000_000, outputTokens: 0 });
    expect(cost).toBeCloseTo(5, 6);
    expect(mods.pricing.isPricedModel("some-unreleased-model")).toBe(false);
    expect(mods.pricing.isPricedModel("claude-sonnet-5")).toBe(true);
  });

  it("records every token class from the provider response", async () => {
    createMock.mockResolvedValue(
      toolResponse({ input_tokens: 120, cache_creation_input_tokens: 800, cache_read_input_tokens: 640 }),
    );
    await runAnalysis(await freshApplicationId());

    const events = await db.select().from(aiUsageEvents);
    expect(events).toHaveLength(1);
    expect(events[0].outcome).toBe("ok");
    expect(events[0].inputTokens).toBe(120);
    expect(events[0].cacheCreationInputTokens).toBe(800);
    expect(events[0].cacheReadInputTokens).toBe(640);
    expect(Number(events[0].costUsd)).toBeGreaterThan(0);

    const status = await mods.spend.budgetStatus();
    expect(status.dayUsd).toBeGreaterThan(0);
    expect(status.exceeded).toBe(false);
  });

  it("reports a cache hit rate the admin page can show", async () => {
    createMock.mockResolvedValue(
      toolResponse({ input_tokens: 100, cache_read_input_tokens: 900, cache_creation_input_tokens: 0 }),
    );
    await runAnalysis(await freshApplicationId());

    const summary = await mods.spend.spendSummary();
    expect(summary.cacheHitRate).toBeCloseTo(0.9, 3);
    expect(summary.callsThisMonth).toBe(1);
  });
});

describe("budget cap", () => {
  it("stops calling the provider once the daily budget is spent", async () => {
    vi.resetModules();
    applyEnv({ AI_DAILY_BUDGET_USD: "0.001" });
    mods = await loadModules();
    createMock.mockResolvedValue(toolResponse());

    const first = await runAnalysis(await freshApplicationId());
    expect(first.state).toBe("ready");
    expect(createMock).toHaveBeenCalledTimes(1);

    const second = await runAnalysis(await freshApplicationId());
    expect(second.state).toBe("unavailable");
    if (second.state !== "unavailable") return;
    expect(second.reason).toBe("budget_exceeded");
    expect(createMock).toHaveBeenCalledTimes(1);
  });

  it("records the block so an administrator can see why nothing ran", async () => {
    vi.resetModules();
    applyEnv({ AI_DAILY_BUDGET_USD: "0" });
    mods = await loadModules();
    createMock.mockResolvedValue(toolResponse());

    await runAnalysis(await freshApplicationId());

    const events = await db.select().from(aiUsageEvents);
    expect(events).toHaveLength(1);
    expect(events[0].outcome).toBe("blocked");
    expect(events[0].errorCode).toBe("budget_exceeded");
    expect(createMock).not.toHaveBeenCalled();
  });
});

describe("rate limiting", () => {
  it("caps how often one application can be re-analysed", async () => {
    vi.resetModules();
    applyEnv({ AI_MAX_CALLS_PER_SUBJECT_PER_HOUR: "2" });
    mods = await loadModules();
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

  it("caps the whole deployment, not just one application", async () => {
    vi.resetModules();
    applyEnv({ AI_MAX_CALLS_PER_MINUTE: "1" });
    mods = await loadModules();
    createMock.mockResolvedValue(toolResponse());

    expect((await runAnalysis(await freshApplicationId())).state).toBe("ready");
    const blocked = await runAnalysis(await freshApplicationId());

    expect(blocked.state).toBe("unavailable");
    if (blocked.state !== "unavailable") return;
    expect(blocked.reason).toBe("throttled");
  });

  it("does not consume a slot for a request that was already over the limit", async () => {
    vi.resetModules();
    applyEnv({ AI_MAX_CALLS_PER_MINUTE: "1" });
    mods = await loadModules();
    createMock.mockResolvedValue(toolResponse());

    await runAnalysis(await freshApplicationId());
    await runAnalysis(await freshApplicationId());
    await runAnalysis(await freshApplicationId());

    const rows = await db.select().from(aiRateLimits);
    const minute = rows.find((row) => row.bucket === "global:minute");
    expect(minute?.count).toBe(1);
  });

  it("hands the slot back when the provider call itself fails", async () => {
    createMock.mockRejectedValue(Object.assign(new Error("boom"), { status: 500 }));
    await runAnalysis(await freshApplicationId());

    const rows = await db.select().from(aiRateLimits);
    const minute = rows.find((row) => row.bucket === "global:minute");
    expect(minute?.count).toBe(0);
  });
});

describe("circuit breaker", () => {
  it("stops calling the provider after a run of failures", async () => {
    vi.resetModules();
    applyEnv({ AI_BREAKER_FAILURE_THRESHOLD: "2" });
    mods = await loadModules();
    mods.breaker.resetBreakers();
    createMock.mockRejectedValue(Object.assign(new Error("down"), { status: 503 }));

    await runAnalysis(await freshApplicationId());
    await runAnalysis(await freshApplicationId());
    expect(createMock).toHaveBeenCalledTimes(2);

    const blocked = await runAnalysis(await freshApplicationId());
    expect(createMock).toHaveBeenCalledTimes(2);
    expect(blocked.state).toBe("unavailable");
    if (blocked.state !== "unavailable") return;
    expect(blocked.reason).toBe("provider_unavailable");
  });

  it("closes again after a call succeeds", async () => {
    createMock.mockRejectedValueOnce(Object.assign(new Error("down"), { status: 503 }));
    await runAnalysis(await freshApplicationId());
    expect(mods.breaker.breakerSnapshot()[0].consecutiveFailures).toBe(1);

    createMock.mockResolvedValue(toolResponse());
    await runAnalysis(await freshApplicationId());
    expect(mods.breaker.breakerSnapshot()[0].consecutiveFailures).toBe(0);
    expect(mods.breaker.breakerSnapshot()[0].open).toBe(false);
  });
});

describe("request collapsing", () => {
  it("serves two concurrent identical analyses from one provider call", async () => {
    const pendingCalls: Array<(value: unknown) => void> = [];
    createMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          pendingCalls.push(resolve);
        }),
    );

    const applicationId = await freshApplicationId();
    const both = Promise.all([
      mods.analysis.runApplicationAnalysis({
        applicationId,
        criteria,
        evidence,
        projectTitle: "Cardiovascular Outcomes",
        projectSummary: "Analyze retrospective clinical data.",
        isPaidPosition: false,
      }),
      mods.analysis.runApplicationAnalysis({
        applicationId,
        criteria,
        evidence,
        projectTitle: "Cardiovascular Outcomes",
        projectSummary: "Analyze retrospective clinical data.",
        isPaidPosition: false,
      }),
    ]);

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
    vi.resetModules();
    applyEnv({ AI_NEGATIVE_CACHE_TTL_MINUTES: "30" });
    mods = await loadModules();

    const applicationId = await freshApplicationId();
    createMock.mockRejectedValueOnce(Object.assign(new Error("boom"), { status: 500 }));
    const failed = await runAnalysis(applicationId);
    expect(failed.state).toBe("unavailable");

    createMock.mockResolvedValue(toolResponse());
    const stillCached = await runAnalysis(applicationId, { force: false });
    expect(stillCached.state).toBe("unavailable");
    expect(createMock).toHaveBeenCalledTimes(1);

    const { aiAnalyses } = await import("@/db");
    await db.update(aiAnalyses).set({ createdAt: new Date(Date.now() - 60 * 60 * 1000) });

    const retried = await runAnalysis(applicationId, { force: false });
    expect(createMock).toHaveBeenCalledTimes(2);
    expect(retried.state).toBe("ready");
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

    const { aiAnalyses } = await import("@/db");
    await db.update(aiAnalyses).set({ createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000) });

    const again = await runAnalysis(applicationId, { force: false });
    expect(createMock).toHaveBeenCalledTimes(1);
    expect(again.state).toBe("unavailable");
  });
});

describe("input size guard", () => {
  it("trims a single oversized answer instead of paying to send it", async () => {
    createMock.mockResolvedValue(toolResponse());
    const flood = "x".repeat(50_000);

    await runAnalysis(await freshApplicationId(), {
      evidence: {
        ...evidence,
        answers: [{ questionId: "q1", prompt: "Tell us everything", text: flood }],
      },
    });

    const content = createMock.mock.calls[0][0].messages[0].content as TextBlock[];
    expect(content[1].text.length).toBeLessThan(12_000);
    expect(content[1].text).toContain("shortened to fit the review budget");
  });

  it("still closes the untrusted wrapper after trimming", async () => {
    createMock.mockResolvedValue(toolResponse());

    await runAnalysis(await freshApplicationId(), {
      evidence: {
        ...evidence,
        answers: [{ questionId: "q1", prompt: "Tell us everything", text: "y".repeat(50_000) }],
      },
    });

    const content = createMock.mock.calls[0][0].messages[0].content as TextBlock[];
    expect(content[1].text).toContain("</applicant_material>");
  });
});

describe("student alignment cache", () => {
  it("answers a repeated view from the cache instead of the provider", async () => {
    createMock.mockResolvedValue(alignmentResponse());

    const first = await mods.alignment.analyzeInterestAlignment(alignmentInput);
    expect(first.state).toBe("ready");
    expect(createMock).toHaveBeenCalledTimes(1);

    const second = await mods.alignment.analyzeInterestAlignment(alignmentInput);
    expect(second.state).toBe("ready");
    if (second.state !== "ready") return;
    expect(second.alignment.overlaps[0].label).toBe("Python");
    expect(createMock).toHaveBeenCalledTimes(1);

    const cached = await db.select().from(aiResponseCache);
    expect(cached).toHaveLength(1);
    expect(cached[0].hits).toBeGreaterThanOrEqual(1);
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
    const failed = await mods.alignment.analyzeInterestAlignment(alignmentInput);
    expect(failed.state).toBe("unavailable");

    const rows = await db.select().from(aiResponseCache);
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("error");
    const heldForMs = rows[0].expiresAt.getTime() - rows[0].createdAt.getTime();
    expect(heldForMs).toBeLessThanOrEqual(30 * 60 * 1000);
  });

  it("drops an entry once it expires", async () => {
    const { pruneResponseCache, writeResponseCache, readResponseCache } = await import("@/lib/ai/response-cache");
    await writeResponseCache({
      cacheKey: "expired-entry",
      feature: "test",
      model: null,
      ttlMs: -1000,
      result: { overlaps: [], gaps: [] },
    });

    expect(await readResponseCache("expired-entry")).toBeNull();
    expect(await pruneResponseCache()).toBe(0);
  });
});
