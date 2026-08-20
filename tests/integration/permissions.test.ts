import { describe, expect, it } from "vitest";
import { canManageOpportunity, canViewApplication } from "@/lib/auth/permissions";
import type { SessionUser } from "@/lib/auth/session";
import { createApplicationGraph, createOpportunity, createResearcher, createStudent } from "../fixtures";

function session(id: string, role: SessionUser["role"]): SessionUser {
  return {
    id,
    email: `${id}@mcmaster.ca`,
    role,
    accountStatus: "active",
    institutionId: null,
    institutionName: null,
    institutionSlug: null,
    emailVerifiedAt: new Date(),
    onboardingCompletedAt: new Date(),
    displayName: null,
    researcherVerification: role === "researcher" ? "verified" : null,
  };
}

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
