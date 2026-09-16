import { beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import {
  db,
  opportunities,
  opportunityCriteria,
  opportunityDurations,
  opportunityFields,
  opportunitySkills,
  researchFields,
  skills as skillsTable,
} from "@/db";
import type { SessionUser } from "@/lib/auth/session";
import { createResearcher } from "../fixtures";

/**
 * The posting form is one page and one server action, so the only honest way to
 * test it is to hand that action the form data a browser would send. Everything
 * mocked here is request plumbing the action needs but the form does not shape:
 * who is signed in, and where the browser goes afterwards.
 */
let signedIn: SessionUser | null = null;

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    const error = new Error(`REDIRECT:${url}`);
    (error as { digest?: string }).digest = `NEXT_REDIRECT;${url}`;
    throw error;
  },
}));

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

vi.mock("@/lib/auth/permissions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/permissions")>();
  return {
    ...actual,
    requireResearcher: async () => {
      if (!signedIn) throw new Error("no researcher signed in");
      return signedIn;
    },
  };
});

const { createSimpleOpportunityAction } = await import("@/app/(app)/researcher/opportunities/actions");

async function signIn(verified: boolean) {
  const user = await createResearcher(verified);
  signedIn = {
    id: user.id,
    email: user.email,
    role: "researcher",
    accountStatus: "active",
    institutionId: user.institutionId,
    institutionName: "Example University",
    institutionSlug: "example-university",
    emailVerifiedAt: user.emailVerifiedAt,
    onboardingCompletedAt: user.onboardingCompletedAt,
    displayName: "Test Researcher",
    researcherVerification: verified ? "verified" : "pending",
    photoFileId: null,
  };
  return user;
}

async function anyField() {
  const [field] = await db.select().from(researchFields).orderBy(asc(researchFields.name)).limit(1);
  if (field) return field;
  const [created] = await db
    .insert(researchFields)
    .values({ name: "Epidemiology", slug: `epidemiology-${randomUUID().slice(0, 6)}` })
    .returning();
  return created;
}

/** Exactly what the form posts, before any per-test changes. */
function formData(overrides: Record<string, string | string[]> = {}) {
  const base: Record<string, string | string[]> = {
    title: "Undergraduate Research Assistant, Cardiovascular Outcomes",
    summary: "Help track how patients recover in the year after a cardiac procedure, using hospital records.",
    department: "Health Research Methods, Evidence, and Impact",
    deadline: "2027-01-31",
    preferredDurations: ["one_semester", "two_semesters"],
    compensation: "volunteer",
    locationMode: "hybrid",
    weightGpa: "50",
    weightExtracurriculars: "0",
    weightPriorResearch: "20",
    weightResearchInterests: "80",
    weightSkills: "70",
  };

  const merged = { ...base, ...overrides };
  const data = new FormData();
  for (const [key, value] of Object.entries(merged)) {
    if (Array.isArray(value)) for (const item of value) data.append(key, item);
    else if (value !== "") data.set(key, value);
  }
  return data;
}

/** Runs the action and returns where it sent the browser, or the error it returned. */
async function post(data: FormData) {
  try {
    const result = await createSimpleOpportunityAction(null, data);
    return { redirectedTo: null as string | null, result };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("REDIRECT:")) return { redirectedTo: message.slice("REDIRECT:".length), result: null };
    throw error;
  }
}

async function loadPosted(redirectedTo: string | null) {
  const slug = String(redirectedTo).replace("/opportunities/", "");
  const [row] = await db.select().from(opportunities).where(eq(opportunities.slug, slug)).limit(1);
  expect(row, `no listing was written for ${redirectedTo}`).toBeDefined();
  return row;
}

beforeEach(() => {
  signedIn = null;
});

describe("posting from the one page form", () => {
  it("publishes a complete listing in one submission", async () => {
    await signIn(true);
    const field = await anyField();

    const { redirectedTo, result } = await post(
      formData({ researchFieldId: field.id, outcomes: ["authorship", "poster"], skillName: ["Python", "Data analysis"] }),
    );

    expect(result).toBeNull();
    expect(redirectedTo).toMatch(/^\/opportunities\//);

    const posted = await loadPosted(redirectedTo);
    expect(posted.status).toBe("published");
    expect(posted.publishedAt).not.toBeNull();
    expect(posted.title).toContain("Cardiovascular Outcomes");
    expect(posted.locationMode).toBe("hybrid");
    expect(posted.compensationType).toBe("volunteer");
    // Outcomes are a listing field, not a lost checkbox.
    expect(posted.expectedOutputs).toBe("Authorship, Poster");

    const durations = await db
      .select()
      .from(opportunityDurations)
      .where(eq(opportunityDurations.opportunityId, posted.id));
    expect(durations.map((row) => row.duration).sort()).toEqual(["one_semester", "two_semesters"]);

    const fields = await db.select().from(opportunityFields).where(eq(opportunityFields.opportunityId, posted.id));
    expect(fields).toHaveLength(1);
    expect(fields[0].researchFieldId).toBe(field.id);

    const attached = await db
      .select({ name: skillsTable.name })
      .from(opportunitySkills)
      .innerJoin(skillsTable, eq(skillsTable.id, opportunitySkills.skillId))
      .where(eq(opportunitySkills.opportunityId, posted.id));
    expect(attached.map((row) => row.name).sort()).toEqual(["Data analysis", "Python"]);
  });

  it("turns the weight sliders into criteria a reviewer can act on", async () => {
    await signIn(true);
    const field = await anyField();

    const { redirectedTo } = await post(
      formData({
        researchFieldId: field.id,
        skillName: ["Python"],
        weightGpa: "10",
        weightExtracurriculars: "0",
        weightPriorResearch: "50",
        weightResearchInterests: "90",
        weightSkills: "70",
      }),
    );

    const posted = await loadPosted(redirectedTo);
    const criteria = await db
      .select()
      .from(opportunityCriteria)
      .where(eq(opportunityCriteria.opportunityId, posted.id))
      .orderBy(asc(opportunityCriteria.sortOrder));

    // A weight of zero says the project does not care, so nothing is stored.
    expect(criteria.some((row) => row.type === "custom")).toBe(false);

    // Heaviest first: that ordering is the whole promise the sliders make.
    expect(criteria.map((row) => row.type)).toEqual([
      "research_interest",
      "skill",
      "prior_research",
      "academic_metric",
    ]);
    expect(criteria.map((row) => row.importance)).toEqual(["high", "high", "medium", "low"]);
    expect(criteria.every((row) => row.required === false)).toBe(true);
    expect(criteria[0].config).toMatchObject({ fieldSlugs: [field.slug] });
    expect(criteria[1].config).toMatchObject({ skillName: "Python" });
  });

  it("makes prior research a required criterion when the form says it is required", async () => {
    await signIn(true);
    const field = await anyField();

    const { redirectedTo } = await post(
      formData({ researchFieldId: field.id, priorResearchRequired: "true", weightPriorResearch: "10" }),
    );

    const posted = await loadPosted(redirectedTo);
    expect(posted.priorResearchRequired).toBe(true);

    const [criterion] = await db
      .select()
      .from(opportunityCriteria)
      .where(and(eq(opportunityCriteria.opportunityId, posted.id), eq(opportunityCriteria.type, "prior_research")));
    expect(criterion.required).toBe(true);
    expect(criterion.importance).toBe("required");
    expect(criterion.sortOrder).toBe(0);
  });

  it("queues the listing for review when the account is not verified yet", async () => {
    await signIn(false);
    const field = await anyField();

    const { redirectedTo, result } = await post(formData({ researchFieldId: field.id }));

    expect(result).toBeNull();
    const posted = await loadPosted(redirectedTo);
    expect(posted.status).toBe("pending_review");
    expect(posted.publishedAt).toBeNull();
  });

  it("posts a paid position with no summary, since both are optional", async () => {
    await signIn(true);
    const field = await anyField();

    const { redirectedTo, result } = await post(formData({ researchFieldId: field.id, compensation: "paid", summary: "" }));

    expect(result).toBeNull();
    const posted = await loadPosted(redirectedTo);
    expect(posted.compensationType).toBe("paid");
    expect(posted.summary).toBe("");
    expect(posted.hoursPerWeekMin).toBeNull();
  });

  it("hands the whole submission back when it refuses one, so nothing typed is lost", async () => {
    await signIn(true);
    const field = await anyField();

    const { result } = await post(
      formData({
        researchFieldId: field.id,
        preferredDurations: [],
        outcomes: ["authorship"],
        skillName: ["Python"],
        otherSkillName: ["Optical coherence tomography"],
        beginnerFriendly: "true",
      }),
    );

    expect(result?.ok).toBe(false);
    const values = result?.ok === false ? result.values : undefined;
    expect(values?.title?.[0]).toContain("Cardiovascular Outcomes");
    expect(values?.summary?.[0]).toContain("cardiac procedure");
    expect(values?.deadline?.[0]).toBe("2027-01-31");
    expect(values?.researchFieldId?.[0]).toBe(field.id);
    expect(values?.compensation?.[0]).toBe("volunteer");
    expect(values?.skillName).toEqual(["Python"]);
    expect(values?.otherSkillName).toEqual(["Optical coherence tomography"]);
    expect(values?.outcomes).toEqual(["authorship"]);
    expect(values?.beginnerFriendly).toEqual(["true"]);
    expect(values?.locationMode?.[0]).toBe("hybrid");
    // The sliders too: a researcher who set a balance should not have to set it twice.
    expect(values?.weightResearchInterests?.[0]).toBe("80");
  });

  it("refuses a listing with no duration chosen", async () => {
    await signIn(true);
    const field = await anyField();

    const { result } = await post(formData({ researchFieldId: field.id, preferredDurations: [] }));

    expect(result?.ok).toBe(false);
    if (result?.ok === false) expect(result.fieldErrors?.preferredDurations?.[0]).toContain("at least one length");
  });

  it("creates the research field a supervisor names under Other, and posts under it", async () => {
    await signIn(true);
    const name = `Sleep and circadian biology ${randomUUID().slice(0, 6)}`;

    const { redirectedTo, result } = await post(
      formData({ researchFieldId: "other", otherResearchField: name }),
    );

    expect(result).toBeNull();
    const posted = await loadPosted(redirectedTo);

    const [created] = await db.select().from(researchFields).where(eq(researchFields.name, name)).limit(1);
    expect(created, "the named field was not added to the taxonomy").toBeDefined();

    const fields = await db.select().from(opportunityFields).where(eq(opportunityFields.opportunityId, posted.id));
    expect(fields.map((row) => row.researchFieldId)).toEqual([created.id]);
  });

  it("refuses Other as a research field when nothing is typed alongside it", async () => {
    await signIn(true);

    const { result } = await post(formData({ researchFieldId: "other" }));

    expect(result?.ok).toBe(false);
    if (result?.ok === false) expect(result.fieldErrors?.otherResearchField?.[0]).toContain("Name the research field");
  });

  it("accepts a length described under Other with none of the five ticked", async () => {
    await signIn(true);
    const field = await anyField();

    const { redirectedTo, result } = await post(
      formData({ researchFieldId: field.id, preferredDurations: [], otherDuration: "Eight weeks over the winter term" }),
    );

    expect(result).toBeNull();
    const posted = await loadPosted(redirectedTo);
    expect(posted.duration).toBe("Eight weeks over the winter term");

    // Nothing matchable was invented for it: the free text is the whole answer.
    const durations = await db
      .select()
      .from(opportunityDurations)
      .where(eq(opportunityDurations.opportunityId, posted.id));
    expect(durations).toEqual([]);
  });

  it("keeps both the ticked lengths and the one described under Other", async () => {
    await signIn(true);
    const field = await anyField();

    const { redirectedTo } = await post(
      formData({
        researchFieldId: field.id,
        preferredDurations: ["one_semester"],
        otherDuration: "Or a single reading week if that suits you",
      }),
    );

    const posted = await loadPosted(redirectedTo);
    expect(posted.duration).toBe("Or a single reading week if that suits you");

    const durations = await db
      .select()
      .from(opportunityDurations)
      .where(eq(opportunityDurations.opportunityId, posted.id));
    expect(durations.map((row) => row.duration)).toEqual(["one_semester"]);
  });

  it("gives a second listing with the same title its own address", async () => {
    await signIn(true);
    const field = await anyField();

    const first = await post(formData({ researchFieldId: field.id }));
    const second = await post(formData({ researchFieldId: field.id }));

    expect(first.redirectedTo).not.toBe(second.redirectedTo);
  });
});
