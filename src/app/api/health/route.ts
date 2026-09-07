import { NextResponse } from "next/server";
import { checkDatabase } from "@/lib/diagnostics";
import { log } from "@/lib/log";
import { maybeRunWeeklyDigest } from "@/lib/notifications/schedule";

export const dynamic = "force-dynamic";

export async function GET() {
  const database = await checkDatabase();

  if (!database.ok) {
    log.error("health_database_unreachable", { detail: database.detail });
  }

  // The platform already pings this on a schedule, which makes it the one
  // heartbeat every deployment has for free. The call returns immediately and
  // does its work detached, so a digest can never slow this down or make a
  // healthy service look unhealthy. It only touches the database at most once
  // an hour per process, and only after the week's send time has passed.
  if (database.ok) maybeRunWeeklyDigest();

  return NextResponse.json({ status: "ok", database: database.ok ? "connected" : "unavailable" });
}
