"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db, users } from "@/db";
import {
  assertVerifiableEmail,
  consumeVerificationCode,
  issueVerificationCode,
  normalizeEmail,
  resolveInstitutionForEmail,
} from "@/lib/auth/codes";
import { createSession } from "@/lib/auth/session";
import { sendVerificationCode } from "@/lib/email";
import { recordAudit, recordEvent } from "@/lib/events";
import type { ActionResult } from "@/lib/errors";
import { isEnabled } from "@/lib/flags";
import { log } from "@/lib/log";
import { parseForm, toActionError } from "@/lib/action-utils";
import { requestCodeSchema, verifyCodeSchema } from "@/lib/validation/auth";

async function clientIp(): Promise<string | undefined> {
  const store = await headers();
  const forwarded = store.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() ?? undefined;
}

export async function requestCodeAction(_prev: ActionResult<{ email: string }> | null, formData: FormData) {
  const parsed = parseForm(requestCodeSchema, formData);
  if (!parsed.ok) return parsed.result;

  const email = parsed.data.email;

  try {
    assertVerifiableEmail(email);

    const existing = await db.select({ id: users.id, role: users.role, accountStatus: users.accountStatus }).from(users).where(eq(users.email, email)).limit(1);
    const account = existing[0];

    if (account?.accountStatus === "disabled" || account?.accountStatus === "suspended") {
      return { ok: false as const, error: "This account is not active. Contact hello@myresearchbridge.com." };
    }

    if (!account) {
      const institution = await resolveInstitutionForEmail(email);
      if (!institution) {
        return {
          ok: false as const,
          error:
            "That email domain is not part of the pilot yet. Join the waitlist and we will contact you when your institution is added.",
          fieldErrors: { email: ["Institution not recognized for this address."] },
        };
      }
      if (!(await isEnabled("PUBLIC_SIGNUP_ENABLED"))) {
        return { ok: false as const, error: "New accounts are paused right now. Join the waitlist and we will be in touch." };
      }
    }

    const ip = await clientIp();
    const code = await issueVerificationCode(email, ip);
    const delivery = await sendVerificationCode(email, code);

    if (!delivery.ok) {
      return {
        ok: false as const,
        error: "We could not send a code to that address right now. Try again in a moment.",
      };
    }

    await recordAudit({ action: "verification_code_requested", subjectType: "email", detail: { email }, ip });
    return { ok: true as const, data: { email } };
  } catch (error) {
    return toActionError(error, "request_code_failed");
  }
}

export async function verifyCodeAction(_prev: ActionResult | null, formData: FormData) {
  const parsed = parseForm(verifyCodeSchema, formData);
  if (!parsed.ok) return parsed.result;

  const { email, code } = parsed.data;
  let destination = "/onboarding";

  try {
    const accepted = await consumeVerificationCode(email, code);
    if (!accepted) {
      return {
        ok: false as const,
        error: "That code is not valid or has expired. Request a new code and try again.",
        fieldErrors: { code: ["Enter the six-digit verification code sent to your institutional email."] },
      };
    }

    const normalized = normalizeEmail(email);
    const existing = await db.select().from(users).where(eq(users.email, normalized)).limit(1);
    let account = existing[0];

    if (!account) {
      const institution = await resolveInstitutionForEmail(normalized);
      const [created] = await db
        .insert(users)
        .values({
          email: normalized,
          institutionId: institution?.id ?? null,
          accountStatus: "active",
          emailVerifiedAt: new Date(),
        })
        .returning();
      account = created;
      await recordEvent({ name: "account_verified", userId: account.id, institutionId: account.institutionId });
    } else {
      await db
        .update(users)
        .set({ emailVerifiedAt: account.emailVerifiedAt ?? new Date(), lastLoginAt: new Date(), accountStatus: account.accountStatus === "pending" ? "active" : account.accountStatus })
        .where(eq(users.id, account.id));
    }

    const store = await headers();
    await createSession(account.id, store.get("user-agent") ?? undefined);
    await recordAudit({ actorId: account.id, action: "signed_in", subjectType: "user", subjectId: account.id });

    if (!account.role) destination = "/onboarding";
    else if (!account.onboardingCompletedAt) {
      destination = account.role === "researcher" ? "/onboarding/researcher" : account.role === "student" ? "/onboarding/student" : "/admin";
    } else if (account.role === "admin") destination = "/admin";
    else if (account.role === "researcher") destination = "/researcher";
    else destination = "/dashboard";

    log.info("sign_in_succeeded", { userId: account.id, role: account.role });
  } catch (error) {
    return toActionError(error, "verify_code_failed");
  }

  redirect(destination);
}
