import { NextResponse } from "next/server";
import { and, eq, or } from "drizzle-orm";
import {
  applicationAnswers,
  applications,
  db,
  opportunities,
  storedFiles,
  studentProfiles,
} from "@/db";
import { getSessionUser } from "@/lib/auth/session";
import { log } from "@/lib/log";
import { storage } from "@/lib/storage";

export const dynamic = "force-dynamic";

async function isAuthorized(fileId: string, userId: string, role: string | null): Promise<boolean> {
  if (role === "admin") return true;

  const owned = await db
    .select({ id: storedFiles.id })
    .from(storedFiles)
    .where(and(eq(storedFiles.id, fileId), eq(storedFiles.ownerId, userId)))
    .limit(1);
  if (owned.length > 0) return true;

  if (role !== "researcher") return false;

  const viaAnswer = await db
    .select({ id: applications.id })
    .from(applicationAnswers)
    .innerJoin(applications, eq(applications.id, applicationAnswers.applicationId))
    .innerJoin(opportunities, eq(opportunities.id, applications.opportunityId))
    .where(and(eq(applicationAnswers.fileId, fileId), eq(opportunities.researcherId, userId)))
    .limit(1);
  if (viaAnswer.length > 0) return true;

  const viaProfile = await db
    .select({ id: applications.id })
    .from(applications)
    .innerJoin(opportunities, eq(opportunities.id, applications.opportunityId))
    .innerJoin(studentProfiles, eq(studentProfiles.userId, applications.studentId))
    .where(
      and(
        eq(opportunities.researcherId, userId),
        or(
          eq(studentProfiles.resumeFileId, fileId),
          eq(studentProfiles.transcriptFileId, fileId),
          eq(studentProfiles.writingSampleFileId, fileId),
          eq(studentProfiles.videoIntroFileId, fileId),
        ),
      ),
    )
    .limit(1);

  return viaProfile.length > 0;
}

export async function GET(_request: Request, context: { params: Promise<{ fileId: string }> }) {
  const { fileId } = await context.params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in to open this file." }, { status: 401 });

  if (!(await isAuthorized(fileId, user.id, user.role))) {
    log.warn("authorization_denied", { action: "download_file", userId: user.id, fileId });
    return NextResponse.json({ error: "You do not have access to this file." }, { status: 403 });
  }

  const rows = await db.select().from(storedFiles).where(eq(storedFiles.id, fileId)).limit(1);
  const record = rows[0];
  if (!record) return NextResponse.json({ error: "That file could not be found." }, { status: 404 });

  const body = await storage().get(record.storageKey);
  if (!body) return NextResponse.json({ error: "That file is no longer stored." }, { status: 404 });

  return new NextResponse(new Uint8Array(body), {
    headers: {
      "Content-Type": record.contentType,
      "Content-Length": String(record.byteSize),
      "Content-Disposition": `inline; filename="${record.fileName.replace(/"/g, "")}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
