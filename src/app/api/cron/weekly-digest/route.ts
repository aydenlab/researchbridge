import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { log } from "@/lib/log";
import { runWeeklyDigest } from "@/lib/notifications/digest";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Driven by an external scheduler rather than an in-process timer, so a restart
 * or a second web worker cannot cause a week to be skipped or sent twice.
 *
 * Point a weekly cron at this URL with the CRON_SECRET as a bearer token. With
 * no secret configured the endpoint refuses to run rather than running open to
 * anyone who guesses the path.
 */
export async function POST(request: Request) {
  const secret = env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Scheduled jobs are not configured. Set CRON_SECRET to enable this endpoint." },
      { status: 503 },
    );
  }

  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (provided !== secret) {
    log.warn("cron_unauthorized", { job: "weekly_digest" });
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  try {
    // `?force=1` resends a period that has already gone out. Deliberately a
    // query parameter rather than the default, so a retrying scheduler cannot
    // ask for it by accident.
    const force = new URL(request.url).searchParams.get("force") === "1";
    const result = await runWeeklyDigest({ force });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    log.error("cron_weekly_digest_failed", { error });
    return NextResponse.json({ error: "The digest run failed. The error is in the server log." }, { status: 500 });
  }
}
