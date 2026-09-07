import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { log } from "@/lib/log";
import { runWeeklyDigest } from "@/lib/notifications/digest";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Triggers the weekly digest from outside the web process.
 *
 * This is optional. The digest already runs itself off ordinary traffic (see
 * lib/notifications/schedule.ts), and this endpoint exists for deployments that
 * want deterministic timing or need to send a period again by hand.
 *
 * Authentication is deliberately conditional. Setting CRON_SECRET locks the
 * endpoint down completely. Leaving it unset keeps the endpoint open, which is
 * safe only because the run claims its ISO week in the database before sending
 * anything: an anonymous caller can at most cause the week's digest to go out
 * slightly early, never twice, and never in a loop. Resending a period that has
 * already been sent is the one thing that is never open, because that is the
 * only way to make this send the same email to everybody more than once.
 */
export async function POST(request: Request) {
  const secret = env.CRON_SECRET;
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const authorized = Boolean(secret) && provided === secret;

  if (secret && !authorized) {
    log.warn("cron_unauthorized", { job: "weekly_digest" });
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  const force = new URL(request.url).searchParams.get("force") === "1";
  if (force && !authorized) {
    return NextResponse.json(
      {
        error:
          "Resending a period requires CRON_SECRET to be set and supplied. Without it this endpoint can only send a week that has not gone out yet.",
      },
      { status: 401 },
    );
  }

  try {
    const result = await runWeeklyDigest({ force });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    log.error("cron_weekly_digest_failed", { error });
    return NextResponse.json({ error: "The digest run failed. The error is in the server log." }, { status: 500 });
  }
}
