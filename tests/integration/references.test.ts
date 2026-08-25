import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { applicationReferences, db } from "@/db";
import {
  listReferences,
  loadReferenceByToken,
  referenceAlreadyRequested,
  studentEmailForApplication,
  summarizeReferences,
} from "@/lib/queries/references";
import { generateReferenceToken, hashReferenceToken, referenceUrl } from "@/lib/references/tokens";
import { createApplicationGraph } from "../fixtures";

async function addReference(applicationId: string, refereeEmail: string) {
  const token = generateReferenceToken();
  const [row] = await db
    .insert(applicationReferences)
    .values({
      applicationId,
      refereeEmail,
      refereeName: "Dr Referee",
      relationship: "Course instructor",
      tokenHash: hashReferenceToken(token),
    })
    .returning();
  return { token, row };
}

describe("reference tokens", () => {
  it("never stores the token that goes in the email", async () => {
    const token = generateReferenceToken();
    const hash = hashReferenceToken(token);
    expect(hash).not.toContain(token);
    expect(hash).toHaveLength(64);
  });

  it("produces a different token every time", () => {
    const tokens = new Set(Array.from({ length: 50 }, () => generateReferenceToken()));
    expect(tokens.size).toBe(50);
  });

  it("hashes deterministically so a returning link still resolves", () => {
    const token = generateReferenceToken();
    expect(hashReferenceToken(token)).toBe(hashReferenceToken(token));
  });

  it("builds a link that carries the raw token", () => {
    const token = generateReferenceToken();
    expect(referenceUrl(token).endsWith(`/reference/${token}`)).toBe(true);
  });
});

describe("reference lifecycle", () => {
  it("starts pending and resolves by token", async () => {
    const graph = await createApplicationGraph();
    const { token } = await addReference(graph.application.id, "referee-a@example.edu");

    const context = await loadReferenceByToken(token);
    expect(context).not.toBeNull();
    expect(context?.reference.status).toBe("pending");
    expect(context?.opportunityTitle).toBe(graph.opportunity.title);
    expect(context?.studentFirstName).toBe("Test");
  });

  it("returns nothing for a token that was never issued", async () => {
    expect(await loadReferenceByToken(generateReferenceToken())).toBeNull();
  });

  it("does not resolve a token by its stored hash", async () => {
    const graph = await createApplicationGraph();
    const { token } = await addReference(graph.application.id, "referee-b@example.edu");
    // Someone who reads the database sees only the hash, which must be useless as a link.
    expect(await loadReferenceByToken(hashReferenceToken(token))).toBeNull();
  });

  it("refuses the same referee twice on one application", async () => {
    const graph = await createApplicationGraph();
    await addReference(graph.application.id, "duplicate@example.edu");

    expect(await referenceAlreadyRequested(graph.application.id, "duplicate@example.edu")).toBe(true);
    expect(await referenceAlreadyRequested(graph.application.id, "someone-else@example.edu")).toBe(false);
    await expect(addReference(graph.application.id, "duplicate@example.edu")).rejects.toThrow();
  });

  it("lets the same referee be named on a different application", async () => {
    const first = await createApplicationGraph();
    const second = await createApplicationGraph();

    await addReference(first.application.id, "shared@example.edu");
    await expect(addReference(second.application.id, "shared@example.edu")).resolves.toBeTruthy();
  });

  it("records an approval with a timestamp", async () => {
    const graph = await createApplicationGraph();
    const { token, row } = await addReference(graph.application.id, "approver@example.edu");

    await db
      .update(applicationReferences)
      .set({ status: "approved", respondedAt: new Date() })
      .where(eq(applicationReferences.id, row.id));

    const context = await loadReferenceByToken(token);
    expect(context?.reference.status).toBe("approved");
    expect(context?.reference.respondedAt).toBeInstanceOf(Date);
  });

  it("finds the student to notify when a referee answers", async () => {
    const graph = await createApplicationGraph();
    expect(await studentEmailForApplication(graph.application.id)).toBe(graph.student.email);
  });

  it("removes references when the application is deleted", async () => {
    const graph = await createApplicationGraph();
    await addReference(graph.application.id, "cascade@example.edu");
    expect(await listReferences(graph.application.id)).toHaveLength(1);

    const { applications } = await import("@/db");
    await db.delete(applications).where(eq(applications.id, graph.application.id));
    expect(await listReferences(graph.application.id)).toHaveLength(0);
  });

  it("summarizes a mixed set for display", () => {
    const summary = summarizeReferences([
      { status: "approved" },
      { status: "approved" },
      { status: "pending" },
      { status: "declined" },
    ]);
    expect(summary).toEqual({ total: 4, approved: 2, pending: 1, declined: 1 });
  });
});
