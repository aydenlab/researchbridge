import { describe, expect, it } from "vitest";
import { canViewPerson, counterpartRole } from "@/lib/visibility";

const student = { id: "s1", role: "student" as const };
const otherStudent = { id: "s2", role: "student" as const };
const researcher = { id: "r1", role: "researcher" as const };
const otherResearcher = { id: "r2", role: "researcher" as const };
const admin = { id: "a1", role: "admin" as const };

describe("who a signed-in account may browse", () => {
  it("lets the two sides see each other", () => {
    expect(canViewPerson(student, researcher)).toBe(true);
    expect(canViewPerson(researcher, student)).toBe(true);
  });

  it("hides students from other students", () => {
    expect(canViewPerson(student, otherStudent)).toBe(false);
  });

  it("hides researchers from other researchers", () => {
    expect(canViewPerson(researcher, otherResearcher)).toBe(false);
  });

  it("always lets someone see themselves", () => {
    expect(canViewPerson(student, student)).toBe(true);
    expect(canViewPerson(researcher, researcher)).toBe(true);
  });

  it("lets an admin see everyone, and everyone see an admin", () => {
    expect(canViewPerson(admin, student)).toBe(true);
    expect(canViewPerson(admin, researcher)).toBe(true);
    expect(canViewPerson(student, admin)).toBe(true);
    expect(canViewPerson(researcher, admin)).toBe(true);
  });

  it("hides accounts that have not picked a side yet", () => {
    expect(canViewPerson(student, { id: "n1", role: null })).toBe(false);
    expect(canViewPerson({ id: "n1", role: null }, student)).toBe(false);
  });
});

describe("counterpartRole", () => {
  it("points each side at the other", () => {
    expect(counterpartRole("student")).toBe("researcher");
    expect(counterpartRole("researcher")).toBe("student");
  });

  it("gives an admin no single side to filter on", () => {
    expect(counterpartRole("admin")).toBeNull();
    expect(counterpartRole(null)).toBeNull();
  });
});
