import { beforeEach, describe, expect, it, vi } from "vitest";
import { and, desc, eq } from "drizzle-orm";
import { analyticsEvents, applications, applicationStatusHistory, db, notifications } from "@/db";
import type { SessionUser } from "@/lib/auth/session";
import { adminAcceptances } from "@/lib/queries/admin";
import { createApplication, createApplicationGraph, createOpportunity, createResearcher, createStudent } from "../fixtures";

/**
 * Accepting a student, through the server actions a researcher's and a student's
 * browser call. Only who is signed in and the outgoing email are replaced.
 */
let signedIn: SessionUser | null = null;
const sent: { to: string; subject: string; text: string; replyTo?: string }[] = [];

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
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
  return { ...actual, requireResearcher: async () => current(), requireStudent: async () => current() };
});
vi.mock("@/lib/email/providers", () => ({
  resolveProvider: () => ({
    name: "test",
    send: async (message: { to: string; subject: string; text: string; replyTo?: string }) => {
      sent.push(message);
      return { ok: true };
    },
  }),
}));

const { acceptApplicantAction, updateApplicationStatusAction } = await import(
  "@/app/(app)/researcher/opportunities/[id]/applicants/actions"
);
const { withdrawApplicationAction } = await import("@/app/(app)/applications/actions");

function session(user: { id: string; email: string; institutionId: string | null }, role: "student" | "researcher" | "admin") {
  return { id: user.id, email: user.email, role, accountStatus: "active", institutionId: user.institutionId } as unknown as SessionUser;
}

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

async function reload(id: string) {
  const [row] = await db.select().from(applications).where(eq(applications.id, id));
  return row;
}

beforeEach(() => {
  signedIn = null;
  sent.length = 0;
});

describe("a researcher accepting a student", () => {
  it("records who was accepted, when, by whom, and what was said", async () => {
    const { researcher, application } = await createApplicationGraph();
    signedIn = session(researcher, "researcher");

    const before = Date.now();
    const result = await acceptApplicantAction(null, form({ applicationId: application.id, message: "Start in May." }));

    expect(result.ok).toBe(true);
    const row = await reload(application.id);
    expect(row.status).toBe("accepted");
    expect(row.acceptedBy).toBe(researcher.id);
    expect(row.acceptanceMessage).toBe("Start in May.");
    expect(row.acceptedAt!.getTime()).toBeGreaterThanOrEqual(before - 1000);
    expect(row.reviewedAt).not.toBeNull();
  });

  it("tells the student on the platform and by email, replying to the researcher", async () => {
    const { researcher, student, opportunity, application } = await createApplicationGraph();
    signedIn = session(researcher, "researcher");

    await acceptApplicantAction(null, form({ applicationId: application.id, message: "Welcome to the lab." }));

    const [notice] = await db
      .select()
      .from(notifications)
      .where(and(eq(notifications.userId, student.id), eq(notifications.type, "application_accepted")));
    expect(notice.title).toContain("accepted");
    expect(notice.link).toBe(`/applications/${application.id}`);

    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe(student.email);
    expect(sent[0].replyTo).toBe(researcher.email);
    expect(sent[0].subject).toContain(opportunity.title);
    expect(sent[0].text).toContain("Welcome to the lab.");
    expect(sent[0].text).toContain(`/applications/${application.id}`);
  });

  it("appends to the history and counts the event the pilot measures", async () => {
    const { researcher, application } = await createApplicationGraph();
    signedIn = session(researcher, "researcher");

    await acceptApplicantAction(null, form({ applicationId: application.id }));

    const [entry] = await db
      .select()
      .from(applicationStatusHistory)
      .where(eq(applicationStatusHistory.applicationId, application.id))
      .orderBy(desc(applicationStatusHistory.createdAt));
    expect(entry.previousStatus).toBe("submitted");
    expect(entry.newStatus).toBe("accepted");
    expect(entry.changedBy).toBe(researcher.id);

    const events = await db
      .select()
      .from(analyticsEvents)
      .where(and(eq(analyticsEvents.name, "application_accepted"), eq(analyticsEvents.subjectId, application.id)));
    expect(events).toHaveLength(1);
  });

  it("can accept from every open stage, without a note", async () => {
    for (const status of ["submitted", "under_review", "shortlisted", "researcher_contacted", "interview"] as const) {
      const researcher = await createResearcher();
      const student = await createStudent();
      const opportunity = await createOpportunity(researcher.id);
      const application = await createApplication(opportunity.id, student.id, { status, submittedAt: new Date() });
      signedIn = session(researcher, "researcher");

      const result = await acceptApplicantAction(null, form({ applicationId: application.id }));

      expect(result.ok, status).toBe(true);
      expect((await reload(application.id)).acceptanceMessage).toBeNull();
    }
  });

  it("cannot accept what has already closed or never been sent", async () => {
    for (const status of ["draft", "declined", "withdrawn", "position_filled"] as const) {
      const researcher = await createResearcher();
      const student = await createStudent();
      const opportunity = await createOpportunity(researcher.id);
      const application = await createApplication(opportunity.id, student.id, { status });
      signedIn = session(researcher, "researcher");

      const result = await acceptApplicantAction(null, form({ applicationId: application.id }));

      expect(result.ok, status).toBe(false);
      expect((await reload(application.id)).status).toBe(status);
    }
    expect(sent).toHaveLength(0);
  });

  it("does not accept or email twice when the button is pressed twice", async () => {
    const { researcher, application } = await createApplicationGraph();
    signedIn = session(researcher, "researcher");

    const [first, second] = await Promise.all([
      acceptApplicantAction(null, form({ applicationId: application.id })),
      acceptApplicantAction(null, form({ applicationId: application.id })),
    ]);

    expect([first.ok, second.ok].filter(Boolean)).toHaveLength(1);
    expect(sent).toHaveLength(1);
    const history = await db
      .select()
      .from(applicationStatusHistory)
      .where(and(eq(applicationStatusHistory.applicationId, application.id), eq(applicationStatusHistory.newStatus, "accepted")));
    expect(history).toHaveLength(1);
  });

  it("refuses a researcher who does not own the position", async () => {
    const { application } = await createApplicationGraph();
    signedIn = session(await createResearcher(), "researcher");

    const result = await acceptApplicantAction(null, form({ applicationId: application.id }));

    expect(result.ok).toBe(false);
    expect((await reload(application.id)).status).toBe("submitted");
  });

  it("takes the same path when reached through the general status action", async () => {
    const { researcher, application } = await createApplicationGraph();
    signedIn = session(researcher, "researcher");

    const result = await updateApplicationStatusAction(null, form({ applicationId: application.id, status: "accepted" }));

    expect(result.ok).toBe(true);
    const row = await reload(application.id);
    expect(row.acceptedAt).not.toBeNull();
    expect(row.acceptedBy).toBe(researcher.id);
  });
});

describe("after an acceptance", () => {
  it("keeps the record when the researcher withdraws it", async () => {
    const { researcher, application } = await createApplicationGraph();
    signedIn = session(researcher, "researcher");
    await acceptApplicantAction(null, form({ applicationId: application.id }));
    const { acceptedAt } = await reload(application.id);

    const result = await updateApplicationStatusAction(null, form({ applicationId: application.id, status: "declined" }));

    expect(result.ok).toBe(true);
    const row = await reload(application.id);
    expect(row.status).toBe("declined");
    expect(row.acceptedAt).toEqual(acceptedAt);
  });

  it("keeps the record when the student turns it down", async () => {
    const { researcher, student, application } = await createApplicationGraph();
    signedIn = session(researcher, "researcher");
    await acceptApplicantAction(null, form({ applicationId: application.id }));

    signedIn = session(student, "student");
    const result = await withdrawApplicationAction(null, form({ applicationId: application.id }));

    expect(result.ok).toBe(true);
    const row = await reload(application.id);
    expect(row.status).toBe("withdrawn");
    expect(row.acceptedAt).not.toBeNull();
  });

  it("refuses a decline sent from a tab still showing the status before the acceptance", async () => {
    const { researcher, application } = await createApplicationGraph();
    signedIn = session(researcher, "researcher");
    await acceptApplicantAction(null, form({ applicationId: application.id }));
    sent.length = 0;

    const result = await updateApplicationStatusAction(
      null,
      form({ applicationId: application.id, status: "declined", expectedStatus: "submitted" }),
    );

    expect(result.ok).toBe(false);
    expect((await reload(application.id)).status).toBe("accepted");
    expect(sent).toHaveLength(0);
  });

  it("cannot be marked position filled, which would mislead the student who filled it", async () => {
    const { researcher, application } = await createApplicationGraph();
    signedIn = session(researcher, "researcher");
    await acceptApplicantAction(null, form({ applicationId: application.id }));

    const result = await updateApplicationStatusAction(null, form({ applicationId: application.id, status: "position_filled" }));

    expect(result.ok).toBe(false);
    expect((await reload(application.id)).status).toBe("accepted");
  });
});

describe("the operator's record of who was accepted", () => {
  it("lists everyone ever accepted with how to reach both sides, and nobody else", async () => {
    const accepted = await createApplicationGraph();
    const later = await createApplicationGraph();
    const notAccepted = await createApplicationGraph();

    signedIn = session(accepted.researcher, "researcher");
    await acceptApplicantAction(null, form({ applicationId: accepted.application.id }));
    signedIn = session(later.researcher, "researcher");
    await acceptApplicantAction(null, form({ applicationId: later.application.id }));
    await updateApplicationStatusAction(null, form({ applicationId: later.application.id, status: "declined" }));

    const rows = await adminAcceptances();
    const byId = new Map(rows.map((row) => [row.id, row]));

    expect(byId.get(notAccepted.application.id)).toBeUndefined();
    const row = byId.get(accepted.application.id)!;
    expect(row.status).toBe("accepted");
    expect(row.studentEmail).toBe(accepted.student.email);
    expect(row.researcherEmail).toBe(accepted.researcher.email);
    expect(row.opportunityTitle).toBe(accepted.opportunity.title);
    expect(byId.get(later.application.id)!.status).toBe("declined");
  });
});

