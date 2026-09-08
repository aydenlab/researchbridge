import { describe, expect, it } from "vitest";
import { canManageOpportunity, canViewApplication, isVerifiedResearcher } from "@/lib/auth/permissions";
import type { SessionUser } from "@/lib/auth/session";
import { createApplicationGraph, createOpportunity, createResearcher, createStudent } from "../fixtures";

function session(
  id: string,
  role: SessionUser["role"],
  verification?: SessionUser["researcherVerification"],
): SessionUser {
  return {
    id,
    email: `${id}@example.edu`,
    role,
    accountStatus: "active",
    institutionId: null,
    institutionName: null,
    institutionSlug: null,
    emailVerifiedAt: new Date(),
    onboardingCompletedAt: new Date(),
    displayName: null,
    researcherVerification:
      verification === undefined ? (role === "researcher" ? "verified" : null) : verification,
  };
}

describe("who may put a listing in front of students", () => {
  it("allows a verified researcher", () => {
    expect(isVerifiedResearcher(session("r1", "researcher", "verified"))).toBe(true);
  });

  it("refuses a researcher who has not been verified yet", () => {
    expect(isVerifiedResearcher(session("r2", "researcher", "pending"))).toBe(false);
    expect(isVerifiedResearcher(session("r3", "researcher", "needs_review"))).toBe(false);
    expect(isVerifiedResearcher(session("r4", "researcher", "rejected"))).toBe(false);
    expect(isVerifiedResearcher(session("r5", "researcher", null))).toBe(false);
  });

  it("refuses a student outright", () => {
    expect(isVerifiedResearcher(session("s1", "student"))).toBe(false);
  });

  it("allows an admin, who has to be able to act on other people's listings", () => {
    expect(isVerifiedResearcher(session("a1", "admin"))).toBe(true);
  });
});

describe("opportunity management", () => {
  it("lets the owning researcher manage their own position", async () => {
    const researcher = await createResearcher();
    const opportunity = await createOpportunity(researcher.id);

    expect(await canManageOpportunity(session(researcher.id, "researcher"), opportunity.id)).toBe(true);
  });

  it("blocks a different researcher from managing it", async () => {
    const owner = await createResearcher();
    const other = await createResearcher();
    const opportunity = await createOpportunity(owner.id);

    expect(await canManageOpportunity(session(other.id, "researcher"), opportunity.id)).toBe(false);
  });

  it("blocks a student from managing a position", async () => {
    const researcher = await createResearcher();
    const student = await createStudent();
    const opportunity = await createOpportunity(researcher.id);

    expect(await canManageOpportunity(session(student.id, "student"), opportunity.id)).toBe(false);
  });

  it("allows an administrator", async () => {
    const researcher = await createResearcher();
    const opportunity = await createOpportunity(researcher.id);

    expect(await canManageOpportunity(session("admin-id", "admin"), opportunity.id)).toBe(true);
  });
});

describe("application access", () => {
  it("lets the student who applied view their own application", async () => {
    const graph = await createApplicationGraph();
    expect(await canViewApplication(session(graph.student.id, "student"), graph.application.id)).toBe(true);
  });

  it("lets the researcher who controls the position view it", async () => {
    const graph = await createApplicationGraph();
    expect(await canViewApplication(session(graph.researcher.id, "researcher"), graph.application.id)).toBe(true);
  });

  it("blocks another student from viewing it", async () => {
    const graph = await createApplicationGraph();
    const other = await createStudent();

    expect(await canViewApplication(session(other.id, "student"), graph.application.id)).toBe(false);
  });

  it("blocks a researcher who does not control the position", async () => {
    const graph = await createApplicationGraph();
    const other = await createResearcher();

    expect(await canViewApplication(session(other.id, "researcher"), graph.application.id)).toBe(false);
  });

  it("returns false for an application that does not exist", async () => {
    const student = await createStudent();
    expect(await canViewApplication(session(student.id, "student"), "00000000-0000-4000-8000-000000000000")).toBe(false);
  });
});
