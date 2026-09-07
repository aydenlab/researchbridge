import { NextResponse } from "next/server";
import { checkDatabase } from "@/lib/diagnostics";
import { log } from "@/lib/log";

export const dynamic = "force-dynamic";

/**
 * Deliberately does one thing. Railway gates a deployment on this response, so
 * nothing optional belongs here: the weekly digest is scheduled from
 * instrumentation.ts instead, where it cannot affect whether a deploy is
 * considered good.
 */
export async function GET() {
  const database = await checkDatabase();

  if (!database.ok) {
    log.error("health_database_unreachable", { detail: database.detail });
  }

  return NextResponse.json({ status: "ok", database: database.ok ? "connected" : "unavailable" });
}
