import { beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { db, emailVerificationCodes } from "@/db";
import {
  assertVerifiableEmail,
  consumeVerificationCode,
  emailDomain,
  hashCode,
  issueVerificationCode,
  normalizeEmail,
  resolveInstitutionForEmail,
} from "@/lib/auth/codes";
import { RateLimitError } from "@/lib/errors";
import { ensureInstitution } from "../fixtures";

function uniqueEmail() {
  return `verify-${Math.random().toString(36).slice(2, 10)}@example.edu`;
}

beforeEach(async () => {
  await ensureInstitution();
});

describe("email normalization", () => {
  it("lowercases and trims addresses", () => {
    expect(normalizeEmail("  Jordan.Adeyemi@Example.EDU ")).toBe("jordan.adeyemi@example.edu");
    expect(emailDomain("Jordan@Example.EDU")).toBe("example.edu");
  });

  it("rejects malformed addresses", () => {
    expect(() => assertVerifiableEmail("not-an-email")).toThrow();
    expect(() => assertVerifiableEmail("missing@domain")).toThrow();
    expect(() => assertVerifiableEmail("fine@example.edu")).not.toThrow();
  });
});

describe("institution resolution", () => {
  it("resolves a configured institutional domain", async () => {
    const institution = await resolveInstitutionForEmail("someone@example.edu");
    expect(institution?.name).toBe("Example University");
  });

  it("returns null for a domain that is not part of the pilot", async () => {
    expect(await resolveInstitutionForEmail("someone@gmail.com")).toBeNull();
  });
});

describe("verification codes", () => {
  it("issues a six digit code and stores only its hash", async () => {
    const email = uniqueEmail();
    const code = await issueVerificationCode(email);

    expect(code).toMatch(/^\d{6}$/);

    const rows = await db.select().from(emailVerificationCodes).where(eq(emailVerificationCodes.email, email));
    expect(rows).toHaveLength(1);
    expect(rows[0].codeHash).not.toContain(code);
    expect(rows[0].codeHash).toBe(hashCode(email, code));
  });

  it("accepts a correct code once and then refuses it", async () => {
    const email = uniqueEmail();
    const code = await issueVerificationCode(email);

    expect(await consumeVerificationCode(email, code)).toBe(true);
    expect(await consumeVerificationCode(email, code)).toBe(false);
  });

  it("refuses an incorrect code and counts the attempt", async () => {
    const email = uniqueEmail();
    await issueVerificationCode(email);

    expect(await consumeVerificationCode(email, "000000")).toBe(false);

    const rows = await db.select().from(emailVerificationCodes).where(eq(emailVerificationCodes.email, email));
    expect(rows[0].attemptCount).toBe(1);
  });

  it("locks out after five wrong attempts", async () => {
    const email = uniqueEmail();
    const code = await issueVerificationCode(email);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await consumeVerificationCode(email, "111111");
    }

    await expect(consumeVerificationCode(email, code)).rejects.toBeInstanceOf(RateLimitError);
  });

  it("refuses an expired code", async () => {
    const email = uniqueEmail();
    const code = await issueVerificationCode(email);

    await db
      .update(emailVerificationCodes)
      .set({ expiresAt: new Date(Date.now() - 60_000) })
      .where(eq(emailVerificationCodes.email, email));

    expect(await consumeVerificationCode(email, code)).toBe(false);
  });

  it("rate limits repeated requests for the same address", async () => {
    const email = uniqueEmail();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await issueVerificationCode(email);
    }
    await expect(issueVerificationCode(email)).rejects.toBeInstanceOf(RateLimitError);
  });

  it("scopes a code to the address it was issued for", async () => {
    const first = uniqueEmail();
    const second = uniqueEmail();
    const code = await issueVerificationCode(first);
    await issueVerificationCode(second);

    expect(await consumeVerificationCode(second, code)).toBe(false);
    expect(await consumeVerificationCode(first, code)).toBe(true);
  });

  it("marks the used code rather than deleting the record", async () => {
    const email = uniqueEmail();
    const code = await issueVerificationCode(email);
    await consumeVerificationCode(email, code);

    const rows = await db
      .select()
      .from(emailVerificationCodes)
      .where(and(eq(emailVerificationCodes.email, email)));
    expect(rows[0].usedAt).not.toBeNull();
  });
});
