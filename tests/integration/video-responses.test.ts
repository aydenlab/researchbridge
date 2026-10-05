import { beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import { applicationAnswers, applications, db, opportunities, opportunityQuestions, researchFields } from "@/db";
import type { SessionUser } from "@/lib/auth/session";
import { listApplicantsForOpportunity, loadApplication } from "@/lib/queries/applications";
import { listAllApplicants } from "@/lib/queries/researcher";
import { addQuestion, createApplication, createOpportunity, createResearcher, createStudent } from "../fixtures";

/**
 * A video request runs through three server actions: the researcher's posting
 * form (or the edit wizard's video step), the student's draft save, and the
 * submit. Each is handed the form data a browser would send. Only request
 * plumbing is mocked: who is signed in, redirects, and post-response work.
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
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: () => {},
}));

vi.mock("@/lib/auth/permissions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/permissions")>();
  const current = () => {
    if (!signedIn) throw new Error("nobody signed in");
    return signedIn;
  };
  return {
    ...actual,
    requireResearcher: async () => current(),
    requireStudent: async () => current(),
    requireManagedOpportunity: async (opportunityId: string) => {
      const user = current();
      const [opportunity] = await db.select().from(opportunities).where(eq(opportunities.id, opportunityId)).limit(1);
      if (!opportunity || opportunity.researcherId !== user.id) throw new Error("not yours");
      return { user, opportunity };
    },
  };
});

const { createSimpleOpportunityAction, saveVideoStepAction, saveQuestionsStepAction } = await import(
  "@/app/(app)/researcher/opportunities/actions"
);
const { saveDraftAction, submitApplicationAction } = await import("@/app/(app)/applications/actions");

const LOOM = "0281766fa2d04bb788eaf19e65135184";
const YT = "dQw4w9WgXcQ";

function session(user: { id: string; email: string; institutionId: string | null }, role: "student" | "researcher"): SessionUser {
  return {
    id: user.id,
    email: user.email,
    role,
    accountStatus: "active",
    institutionId: user.institutionId,
    institutionName: "Example University",
    institutionSlug: "example-university",
    emailVerifiedAt: new Date(),
    onboardingCompletedAt: new Date(),
    displayName: "Test User",
    researcherVerification: role === "researcher" ? "verified" : null,
    photoFileId: null,
  } as SessionUser;
}

function form(values: Record<string, string | string[] | undefined>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) for (const item of value) data.append(key, item);
    else data.set(key, value);
  }
  return data;
}

/** Runs a server action that may redirect, returning either the target or what it returned. */
async function run<T>(action: () => Promise<T>) {
  try {
    return { redirectedTo: null as string | null, result: await action() };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("REDIRECT:")) return { redirectedTo: message.slice("REDIRECT:".length), result: null };
    throw error;
  }
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

function postingForm(fieldId: string, video: Record<string, string>) {
  return form({
    title: "Undergraduate Research Assistant, Video Intro Lab",
    summary: "A listing that asks for a short video.",
    department: "Health Research Methods, Evidence, and Impact",
    deadline: "2027-01-31",
    preferredDurations: ["one_semester"],
    compensation: "volunteer",
    locationMode: "hybrid",
    researchFieldId: fieldId,
    ...video,
  });
}

async function videoQuestionFor(opportunityId: string) {
  const rows = await db
    .select()
    .from(opportunityQuestions)
    .where(and(eq(opportunityQuestions.opportunityId, opportunityId), eq(opportunityQuestions.type, "video_response")));
  return rows;
}

beforeEach(() => {
  signedIn = null;
});

describe("a researcher asking for a video", () => {
  it("posts a listing that asks for a required video with their own prompt", async () => {
    const researcher = await createResearcher();
    signedIn = session(researcher, "researcher");
    const field = await anyField();

    const { redirectedTo } = await run(() =>
      createSimpleOpportunityAction(
        null,
        postingForm(field.id, {
          videoResponseEnabled: "true",
          videoPrompt: "Introduce yourself and why you want to join this project specifically.",
          videoRequired: "true",
          videoMaxSeconds: "90",
        }),
      ),
    );
    expect(redirectedTo).toMatch(/^\/opportunities\//);

    const [posted] = await db
      .select()
      .from(opportunities)
      .where(eq(opportunities.slug, String(redirectedTo).replace("/opportunities/", "")));
    expect(posted.videoResponseEnabled).toBe(true);
    expect(posted.videoPrompt).toBe("Introduce yourself and why you want to join this project specifically.");
    expect(posted.videoMaxSeconds).toBe(90);

    const questions = await videoQuestionFor(posted.id);
    expect(questions).toHaveLength(1);
    expect(questions[0].required).toBe(true);
    expect(questions[0].prompt).toBe(posted.videoPrompt);
  });

  it("can make the video optional", async () => {
    const researcher = await createResearcher();
    signedIn = session(researcher, "researcher");
    const field = await anyField();

    const { redirectedTo } = await run(() =>
      createSimpleOpportunityAction(
        null,
        postingForm(field.id, {
          videoResponseEnabled: "true",
          videoPrompt: "What relevant skills do you have for this project?",
          videoRequired: "false",
          videoMaxSeconds: "60",
        }),
      ),
    );
    const [posted] = await db
      .select()
      .from(opportunities)
      .where(eq(opportunities.slug, String(redirectedTo).replace("/opportunities/", "")));
    const [question] = await videoQuestionFor(posted.id);
    expect(question.required).toBe(false);
  });

  it("refuses a video request with nothing for the student to cover", async () => {
    const researcher = await createResearcher();
    signedIn = session(researcher, "researcher");
    const field = await anyField();

    const { result } = await run(() =>
      createSimpleOpportunityAction(null, postingForm(field.id, { videoResponseEnabled: "true", videoPrompt: "" })),
    );
    expect(result?.ok).toBe(false);
    expect(result && !result.ok ? result.fieldErrors?.videoPrompt?.[0] : null).toMatch(/what the video should cover/);
  });

  it("writes no video question when none was asked for", async () => {
    const researcher = await createResearcher();
    signedIn = session(researcher, "researcher");
    const field = await anyField();

    const { redirectedTo } = await run(() => createSimpleOpportunityAction(null, postingForm(field.id, {})));
    const [posted] = await db
      .select()
      .from(opportunities)
      .where(eq(opportunities.slug, String(redirectedTo).replace("/opportunities/", "")));
    expect(posted.videoResponseEnabled).toBe(false);
    expect(await videoQuestionFor(posted.id)).toHaveLength(0);
  });

  it("keeps videos already sent when the request is switched off and back on", async () => {
    const researcher = await createResearcher();
    const student = await createStudent();
    const opportunity = await createOpportunity(researcher.id);
    signedIn = session(researcher, "researcher");

    const step = (values: Record<string, string>) =>
      run(() => saveVideoStepAction(null, form({ opportunityId: opportunity.id, ...values })));

    await step({ videoResponseEnabled: "true", videoPrompt: "Say hello.", videoRequired: "true", videoMaxSeconds: "60" });
    const [question] = await videoQuestionFor(opportunity.id);

    const application = await createApplication(opportunity.id, student.id);
    await db.insert(applicationAnswers).values({
      applicationId: application.id,
      questionId: question.id,
      structuredAnswer: { provider: "loom", externalUrl: `https://www.loom.com/share/${LOOM}`, videoId: LOOM },
    });

    await step({});
    const [off] = await db.select().from(opportunities).where(eq(opportunities.id, opportunity.id));
    expect(off.videoResponseEnabled).toBe(false);
    expect(off.videoPrompt).toBe("Say hello.");
    expect(await videoQuestionFor(opportunity.id)).toHaveLength(1);

    await step({ videoResponseEnabled: "true", videoPrompt: "Say hello again.", videoRequired: "false", videoMaxSeconds: "120" });
    const again = await videoQuestionFor(opportunity.id);
    expect(again).toHaveLength(1);
    expect(again[0].id).toBe(question.id);
    expect(again[0].required).toBe(false);
    expect(again[0].prompt).toBe("Say hello again.");

    const answers = await db.select().from(applicationAnswers).where(eq(applicationAnswers.applicationId, application.id));
    expect(answers).toHaveLength(1);
  });

  it("does not drop the video question when the open questions are edited", async () => {
    const researcher = await createResearcher();
    const opportunity = await createOpportunity(researcher.id);
    signedIn = session(researcher, "researcher");

    await run(() =>
      saveVideoStepAction(
        null,
        form({ opportunityId: opportunity.id, videoResponseEnabled: "true", videoPrompt: "Say hello.", videoMaxSeconds: "60" }),
      ),
    );
    const [before] = await videoQuestionFor(opportunity.id);

    await run(() =>
      saveQuestionsStepAction(
        null,
        form({
          opportunityId: opportunity.id,
          questionType: ["long_text", "short_text"],
          questionPrompt: ["Why this lab?", "Which term?"],
          questionHelp: ["", ""],
          questionRequired: ["true", "false"],
          questionOptions: ["", ""],
          questionMaxLength: ["1000", ""],
        }),
      ),
    );

    const questions = await db
      .select()
      .from(opportunityQuestions)
      .where(eq(opportunityQuestions.opportunityId, opportunity.id))
      .orderBy(asc(opportunityQuestions.sortOrder));
    expect(questions.map((question) => question.type)).toEqual(["long_text", "short_text", "video_response"]);
    expect(questions[2].id).toBe(before.id);
  });
});

describe("a student sending a video", () => {
  async function setup(required: boolean) {
    const researcher = await createResearcher();
    const student = await createStudent({ resumeFileId: randomUUID() });
    const opportunity = await createOpportunity(researcher.id, {
      videoResponseEnabled: true,
      videoPrompt: "Introduce yourself.",
      videoMaxSeconds: 60,
    });
    const written = await addQuestion(opportunity.id, { required: false });
    const video = await addQuestion(opportunity.id, {
      type: "video_response",
      prompt: "Introduce yourself.",
      required,
      config: { maxSeconds: 60 },
      sortOrder: 1,
    });
    const application = await createApplication(opportunity.id, student.id);
    signedIn = session(student, "student");
    return { researcher, student, opportunity, written, video, application };
  }

  it("saves a Loom link from a draft in its tidy form", async () => {
    const { video, application } = await setup(true);

    const result = await saveDraftAction(
      null,
      form({
        applicationId: application.id,
        [`q_${video.id}`]: `https://www.loom.com/share/My-intro-${LOOM}?sid=abc`,
        [`q_${video.id}_provider`]: "loom",
      }),
    );
    expect(result.ok).toBe(true);

    const bundle = await loadApplication(application.id);
    const answer = bundle?.answers.find((row) => row.questionId === video.id);
    expect(answer?.structuredAnswer).toEqual({
      provider: "loom",
      externalUrl: `https://www.loom.com/share/${LOOM}`,
      videoId: LOOM,
    });
  });

  it("keeps an unusable link in the draft but refuses to submit it", async () => {
    const { video, application } = await setup(false);
    const key = `q_${video.id}`;

    const { result, redirectedTo } = await run(() =>
      submitApplicationAction(
        null,
        form({ applicationId: application.id, [key]: "https://vimeo.com/123", [`${key}_provider`]: "youtube" }),
      ),
    );
    expect(redirectedTo).toBeNull();
    expect(result?.ok).toBe(false);
    expect(result && !result.ok ? result.fieldErrors?.[key]?.[0] : null).toMatch(/YouTube/);

    const [row] = await db.select().from(applications).where(eq(applications.id, application.id));
    expect(row.status).toBe("draft");
  });

  it("will not submit without a required video", async () => {
    const { video, application } = await setup(true);
    const key = `q_${video.id}`;

    const { result } = await run(() => submitApplicationAction(null, form({ applicationId: application.id, [key]: "" })));
    expect(result?.ok).toBe(false);
    expect(result && !result.ok ? result.error : "").toMatch(/your video/);
    expect(result && !result.ok ? result.fieldErrors?.[key] : null).toBeTruthy();
  });

  it("submits without an optional video", async () => {
    const { video, application } = await setup(false);

    const { redirectedTo } = await run(() =>
      submitApplicationAction(null, form({ applicationId: application.id, [`q_${video.id}`]: "" })),
    );
    expect(redirectedTo).toBe(`/applications/${application.id}?submitted=1`);
  });

  it("submits a YouTube video and the researcher sees it flagged", async () => {
    const { researcher, opportunity, video, application } = await setup(true);

    const { redirectedTo } = await run(() =>
      submitApplicationAction(
        null,
        form({ applicationId: application.id, [`q_${video.id}`]: `https://youtu.be/${YT}`, [`q_${video.id}_provider`]: "youtube" }),
      ),
    );
    expect(redirectedTo).toBe(`/applications/${application.id}?submitted=1`);

    const [row] = await db.select().from(applications).where(eq(applications.id, application.id));
    expect(row.status).toBe("submitted");

    const rail = await listApplicantsForOpportunity(opportunity.id);
    expect(rail.find((applicant) => applicant.id === application.id)?.hasVideo).toBe(true);

    const all = await listAllApplicants(researcher.id);
    expect(all.items.find((applicant) => applicant.id === application.id)?.hasVideo).toBe(true);
  });

  it("ignores the video once the researcher has switched the request off", async () => {
    const { opportunity, video, application } = await setup(true);
    await db.update(opportunities).set({ videoResponseEnabled: false }).where(eq(opportunities.id, opportunity.id));

    // The form no longer shows the field, so nothing is posted for it.
    const { redirectedTo } = await run(() => submitApplicationAction(null, form({ applicationId: application.id })));
    expect(redirectedTo).toBe(`/applications/${application.id}?submitted=1`);
    expect(video.required).toBe(true);
  });
});
