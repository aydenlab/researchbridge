import { NextResponse } from "next/server";
import { checkDatabase } from "@/lib/diagnostics";
import { log } from "@/lib/log";

export const dynamic = "force-dynamic";

export async function GET() {
  const database = await checkDatabase();

  if (!database.ok) {
    log.error("health_database_unreachable", { detail: database.detail });
  }

  return NextResponse.json({ status: "ok", database: database.ok ? "connected" : "unavailable" });
}
