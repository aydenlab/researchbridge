import crypto from "node:crypto";
import { env } from "@/lib/env";

/**
 * A referee is somebody who does not have an account here, so the approval link
 * has to carry its own proof. We mail a random token and store only its HMAC,
 * the same shape used for sign-in codes: a leaked database gives an attacker
 * nothing they can put in a URL.
 */
export function generateReferenceToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashReferenceToken(token: string): string {
  return crypto.createHmac("sha256", env.SESSION_SECRET).update(`reference:${token}`).digest("hex");
}

export function referenceUrl(token: string): string {
  return `${env.APP_URL.replace(/\/$/, "")}/reference/${token}`;
}
