import { beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import {
  db,
  opportunities,
  opportunityCriteria,
  opportunityDurations,
  opportunityFields,
  researchFields,
  studentResearchInterests,
} from "@/db";
import type { SessionUser } from "@/lib/auth/session";
import { DURATION_ORDER } from "@/lib/labels";
import { recommendOpportunities } from "@/lib/queries/recommendations";
import { loadStudentProfile } from "@/lib/queries/student";
import { createOpportunity, createResearcher, createStudent } from "../fixtures";

/**
 * The Future Research Opportunity is created by one server action from the
 * researcher's profile. These tests hand it the form data the browser sends and
 * then check that the result behaves like any other posting: published, matched
 * to students, and open to applications.
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
    requireManagedOpportunity: async (opportunityId: string) => {
      if (!signedIn) throw new Error("no researcher signed in");
      const [opportunity] = await db.select().from(opportunities).where(eq(opportunities.id, opportunityId)).limit(1);
      return { user: signedIn, opportunity };
    },
  };
});

const { createFutureOpportunityAction, saveLogisticsStepAction } = await import(
  "@/app/(app)/researcher/opportunities/actions"
);

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

async function field(name: string) {
  const slug = `${name.toLowerCase().replace(/\W+/g, "-")}-${randomUUID().slice(0, 6)}`;
  const [created] = await db.insert(researchFields).values({ name, slug }).returning();
  return created;
}

function formData(values: Record<string, string | string[]>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) {
    if (Array.isArray(value)) for (const item of value) data.append(key, item);
    else data.set(key, value);
  }
  return data;
}

async function post(data: FormData) {
  try {
    const result = await createFutureOpportunityAction(null, data);
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

describe("creating a Future Research Opportunity", () => {
  it("publishes a posting written from the profile, with no deadline or start date", async () => {
    await signIn(true);
    const cardiology = await field("Cardiology Future");
    const epi = await field("Clinical Epidemiology Future");

    const { redirectedTo, result } = await post(
      formData({ department: "Health Research Methods", researchFieldIds: [cardiology.id, epi.id] }),
    );
    expect(result).toBeNull();

    const posted = await loadPosted(redirectedTo);
    expect(posted.futureOpportunity).toBe(true);
    expect(posted.status).toBe("published");
    expect(posted.title).toBe("Future Research Opportunity: Cardiology Future and Clinical Epidemiology Future");
    expect(posted.summary).toContain("Test Researcher is interested in meeting strong students");
    expect(posted.summary).toContain("No fixed start date or guaranteed position");
    expect(posted.description).toContain("There is no fixed start date and no guaranteed immediate position");
    // The profile biography is carried into the posting so nothing has to be written.
    expect(posted.description).toContain("A fictional research group used only in the test suite.");
    expect(posted.deadline).toBeNull();
    expect(posted.startDate).toBeNull();
    expect(posted.department).toBe("Health Research Methods");

    const fields = await db.select().from(opportunityFields).where(eq(opportunityFields.opportunityId, posted.id));
    expect(fields.map((row) => row.researchFieldId).sort()).toEqual([cardiology.id, epi.id].sort());

    const durations = await db.select().from(opportunityDurations).where(eq(opportunityDurations.opportunityId, posted.id));
    expect(durations.map((row) => row.duration).sort()).toEqual([...DURATION_ORDER].sort());

    const criteria = await db
      .select()
      .from(opportunityCriteria)
      .where(eq(opportunityCriteria.opportunityId, posted.id))
      .orderBy(asc(opportunityCriteria.sortOrder));
    expect(criteria[0].type).toBe("research_interest");
    expect(criteria[0].config).toMatchObject({ fieldSlugs: [cardiology.slug, epi.slug] });
    expect(criteria.some((row) => row.type === "academic_metric")).toBe(true);
    expect(criteria.every((row) => !row.required)).toBe(true);
  });

  it("queues the posting for review when the researcher is not yet verified", async () => {
    await signIn(false);
    const area = await field("Neurology Future");
    const { redirectedTo } = await post(formData({ department: "Medicine", researchFieldIds: [area.id] }));
    const posted = await loadPosted(redirectedTo);
    expect(posted.status).toBe("pending_review");
    expect(posted.publishedAt).toBeNull();
  });

  it("creates an Other research area the researcher typed in", async () => {
    await signIn(true);
    const typed = `Sleep science ${randomUUID().slice(0, 6)}`;
    const { redirectedTo } = await post(
      formData({ department: "Medicine", researchAreaOtherSelected: "on", researchAreaOther: typed }),
    );
    const posted = await loadPosted(redirectedTo);
    const fields = await db
      .select({ name: researchFields.name })
      .from(opportunityFields)
      .innerJoin(researchFields, eq(researchFields.id, opportunityFields.researchFieldId))
      .where(eq(opportunityFields.opportunityId, posted.id));
    expect(fields.map((row) => row.name)).toEqual([typed]);
  });

  it("refuses a posting with no research area, and hands the form back", async () => {
    await signIn(true);
    const { redirectedTo, result } = await post(formData({ department: "Medicine", note: "Keep this" }));
    expect(redirectedTo).toBeNull();
    expect(result?.ok).toBe(false);
    if (!result || result.ok) return;
    expect(result.fieldErrors?.researchFieldIds?.[0]).toMatch(/at least one research area/);
    expect(result.values?.note).toEqual(["Keep this"]);
  });

  it("keeps one live future posting per researcher instead of duplicating it", async () => {
    await signIn(true);
    const area = await field("Genetics Future");
    const first = await post(formData({ department: "Medicine", researchFieldIds: [area.id] }));
    const second = await post(formData({ department: "Medicine", researchFieldIds: [area.id] }));
    expect(second.redirectedTo).toBe(first.redirectedTo);

    const mine = await db.select().from(opportunities).where(eq(opportunities.researcherId, signedIn!.id));
    expect(mine).toHaveLength(1);
  });

  it("is matched to students in its research areas like any other posting", async () => {
    await signIn(true);
    const area = await field("Immunology Future");
    const { redirectedTo } = await post(formData({ department: "Medicine", researchFieldIds: [area.id] }));
    const posted = await loadPosted(redirectedTo);

    const student = await createStudent();
    await db.insert(studentResearchInterests).values({ studentId: student.id, researchFieldId: area.id });
    const bundle = await loadStudentProfile(student.id);

    const recommendations = await recommendOpportunities(bundle!, { limit: 200 });
    const match = recommendations.find((entry) => entry.item.id === posted.id);
    expect(match, "the future posting was not recommended to a student who shares its area").toBeDefined();
    expect(match?.item.futureOpportunity).toBe(true);
    expect(match?.reasons.join(" ")).toContain("Immunology Future");
    // No length is decided yet, so the reasons never claim one.
    expect(match?.reasons.join(" ")).not.toMatch(/Runs for/);
  });

  it("can be edited without a deadline, while an ordinary position still needs one", async () => {
    const researcher = await signIn(true);
    const area = await field("Virology Future");
    const { redirectedTo } = await post(formData({ department: "Medicine", researchFieldIds: [area.id] }));
    const future = await loadPosted(redirectedTo);
    const ordinary = await createOpportunity(researcher.id);

    const logistics = (opportunityId: string) =>
      formData({
        opportunityId,
        numberOfOpenings: "1",
        locationMode: "hybrid",
        compensationType: "other",
        preferredDurations: ["one_semester"],
      });

    const saved = await saveLogisticsStepAction(null, logistics(future.id)).catch((error: Error) => error);
    expect(saved instanceof Error && saved.message.startsWith("REDIRECT:")).toBe(true);
    const [after] = await db.select().from(opportunities).where(eq(opportunities.id, future.id));
    expect(after.deadline).toBeNull();

    const refused = await saveLogisticsStepAction(null, logistics(ordinary.id));
    expect(refused?.ok).toBe(false);
    if (!refused || refused.ok) return;
    expect(refused.fieldErrors?.deadline?.[0]).toBe("Application deadline is required.");
  });
});
