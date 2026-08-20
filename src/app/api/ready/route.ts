import { NextResponse } from "next/server";
import { collectDiagnostics, summarizeEnvironment, type Diagnostics } from "@/lib/diagnostics";
import { getSessionUser } from "@/lib/auth/session";
import { log } from "@/lib/log";

export const dynamic = "force-dynamic";

function redact(diagnostics: Diagnostics) {
  return {
    process: diagnostics.process,
    database: { ok: diagnostics.database.ok },
    migrations: { ok: diagnostics.migrations.ok },
    configuration: { ok: diagnostics.configuration.ok },
  };
}

export async function GET() {
  const diagnostics = await collectDiagnostics();
  const ready = diagnostics.database.ok && diagnostics.migrations.ok;

  if (!ready) {
    log.error("readiness_check_failed", {
      database: diagnostics.database.detail,
      migrations: diagnostics.migrations.detail,
      configuration: diagnostics.configuration.detail,
    });
  }

  let user = null;
  try {
    user = await getSessionUser();
  } catch {
    user = null;
  }

  const isAdmin = user?.role === "admin";

  const body: Record<string, unknown> = {
    status: ready ? "ready" : "not_ready",
    checks: isAdmin ? diagnostics : redact(diagnostics),
  };

  if (isAdmin) {
    body.environment = summarizeEnvironment();
  } else if (!ready) {
    body.detail = "Sign in as an administrator, or read the server logs, to see why.";
  }

  return NextResponse.json(body, { status: ready ? 200 : 503 });
}
