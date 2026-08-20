import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { log } from "@/lib/log";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.execute(sql`select 1`);
    return NextResponse.json({ status: "ok" });
  } catch (error) {
    log.error("health_check_failed", { error });
    return NextResponse.json({ status: "degraded" }, { status: 503 });
  }
}
