import crypto from "node:crypto";
import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { db, emailVerificationCodes, institutionEmailDomains, institutions } from "@/db";
import { env } from "@/lib/env";
import { AppError, RateLimitError } from "@/lib/errors";
import { log } from "@/lib/log";

const CODE_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const MAX_SENDS_PER_HOUR = 5;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function emailDomain(email: string): string {
  return normalizeEmail(email).split("@")[1] ?? "";
}

export function hashCode(email: string, code: string): string {
  return crypto.createHmac("sha256", env.SESSION_SECRET).update(`${normalizeEmail(email)}:${code}`).digest("hex");
}

function generateCode(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

export async function resolveInstitutionForEmail(email: string) {
  const domain = emailDomain(email);
  if (!domain) return null;
  const rows = await db
    .select({
      id: institutions.id,
      name: institutions.name,
      slug: institutions.slug,
      active: institutions.active,
      roleRestriction: institutionEmailDomains.roleRestriction,
    })
    .from(institutionEmailDomains)
    .innerJoin(institutions, eq(institutions.id, institutionEmailDomains.institutionId))
    .where(eq(institutionEmailDomains.domain, domain))
    .limit(1);
  const row = rows[0];
  if (!row || !row.active) return null;
  return row;
}

export async function issueVerificationCode(email: string, requestIp?: string): Promise<string> {
  const normalized = normalizeEmail(email);
  const since = new Date(Date.now() - 60 * 60 * 1000);
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(emailVerificationCodes)
    .where(and(eq(emailVerificationCodes.email, normalized), gt(emailVerificationCodes.createdAt, since)));

  if (count >= MAX_SENDS_PER_HOUR) {
    log.warn("verification_code_rate_limited", { email: normalized });
    throw new RateLimitError("Too many codes have been requested for this address. Try again in an hour.");
  }

  const code = generateCode();
  await db.insert(emailVerificationCodes).values({
    email: normalized,
    codeHash: hashCode(normalized, code),
    expiresAt: new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000),
    requestIp,
  });
  return code;
}

export async function consumeVerificationCode(email: string, code: string): Promise<boolean> {
  const normalized = normalizeEmail(email);
  const rows = await db
    .select()
    .from(emailVerificationCodes)
    .where(
      and(
        eq(emailVerificationCodes.email, normalized),
        isNull(emailVerificationCodes.usedAt),
        gt(emailVerificationCodes.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(emailVerificationCodes.createdAt))
    .limit(1);

  const record = rows[0];
  if (!record) {
    log.warn("verification_code_missing", { email: normalized });
    return false;
  }
  if (record.attemptCount >= MAX_ATTEMPTS) {
    throw new RateLimitError("That code has been entered incorrectly too many times. Request a new code.");
  }

  const provided = hashCode(normalized, code.trim());
  const expected = record.codeHash;
  const matches =
    provided.length === expected.length && crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected));

  if (!matches) {
    await db
      .update(emailVerificationCodes)
      .set({ attemptCount: record.attemptCount + 1 })
      .where(eq(emailVerificationCodes.id, record.id));
    log.warn("verification_code_mismatch", { email: normalized });
    return false;
  }

  await db.update(emailVerificationCodes).set({ usedAt: new Date() }).where(eq(emailVerificationCodes.id, record.id));
  return true;
}

export function assertVerifiableEmail(email: string) {
  const normalized = normalizeEmail(email);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalized)) {
    throw new AppError("Enter a valid email address.", "invalid_email");
  }
}
