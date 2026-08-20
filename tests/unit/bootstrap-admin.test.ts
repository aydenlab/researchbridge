import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL = process.env.ADMIN_EMAILS;

async function load(value: string | undefined) {
  vi.resetModules();
  if (value === undefined) delete process.env.ADMIN_EMAILS;
  else process.env.ADMIN_EMAILS = value;
  return import("@/lib/env");
}

beforeEach(() => {
  delete process.env.ADMIN_EMAILS;
});

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.ADMIN_EMAILS;
  else process.env.ADMIN_EMAILS = ORIGINAL;
});

describe("bootstrap admin allowlist", () => {
  it("treats nobody as an admin when the variable is unset", async () => {
    const { isBootstrapAdmin, adminEmails } = await load(undefined);
    expect(adminEmails.size).toBe(0);
    expect(isBootstrapAdmin("anyone@example.edu")).toBe(false);
  });

  it("recognises a single configured address", async () => {
    const { isBootstrapAdmin } = await load("founder@example.com");
    expect(isBootstrapAdmin("founder@example.com")).toBe(true);
    expect(isBootstrapAdmin("someone.else@example.com")).toBe(false);
  });

  it("accepts a comma separated list and ignores spacing", async () => {
    const { isBootstrapAdmin } = await load("  one@example.com ,two@example.com,  three@example.com ");
    for (const email of ["one@example.com", "two@example.com", "three@example.com"]) {
      expect(isBootstrapAdmin(email)).toBe(true);
    }
    expect(isBootstrapAdmin("four@example.com")).toBe(false);
  });

  it("matches regardless of the case a person types", async () => {
    const { isBootstrapAdmin } = await load("Founder@Example.COM");
    expect(isBootstrapAdmin("founder@example.com")).toBe(true);
    expect(isBootstrapAdmin("  FOUNDER@EXAMPLE.COM  ")).toBe(true);
  });

  it("ignores entries that are not email addresses", async () => {
    const { adminEmails } = await load("not-an-email, real@example.com, also-not");
    expect([...adminEmails]).toEqual(["real@example.com"]);
  });

  it("does not treat an empty or whitespace value as an admin", async () => {
    const { isBootstrapAdmin, adminEmails } = await load("   ");
    expect(adminEmails.size).toBe(0);
    expect(isBootstrapAdmin("")).toBe(false);
    expect(isBootstrapAdmin("   ")).toBe(false);
  });
});
