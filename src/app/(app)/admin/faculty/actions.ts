"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/permissions";
import { optionalText, toActionError } from "@/lib/action-utils";
import { AppError, type ActionResult } from "@/lib/errors";
import { recordAudit } from "@/lib/events";
import {
  addFacultyMember,
  applyFacultyImport,
  planFacultyImport,
  setFacultyPhoto,
  type FacultyRowOutcome,
} from "@/lib/faculty/import";
import { log } from "@/lib/log";
import { storeFile } from "@/lib/storage";

/** One professor typed into the form, for when there is no list to paste. */
export async function addFacultyMemberAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const text = (name: string) => String(formData.get(name) ?? "");

  try {
    const result = await addFacultyMember(
      {
        email: text("email"),
        firstName: text("firstName"),
        lastName: text("lastName"),
        title: text("title"),
        department: text("department"),
        faculty: text("faculty"),
        labName: text("labName"),
        personalWebsite: text("personalWebsite"),
        linkedinUrl: text("linkedinUrl"),
        researchAreas: text("researchAreas"),
        biography: text("biography"),
      },
      { source: "admin_form" },
    );
    if (!result.ok) return { ok: false, error: result.reason };

    // The photo is stored only once the row is accepted, so a refused add never
    // leaves an upload with nothing pointing at it.
    const photoNote = await attachPhoto(formData.get("photo"), result.userId);

    await recordAudit({
      actorId: admin.id,
      action: "faculty_member_added",
      subjectType: "institution",
      detail: { email: result.email, created: result.created },
    });

    revalidatePath("/admin/faculty");
    revalidatePath("/admin/researchers");
    const added = result.created ? `Added ${result.email}` : `Updated the existing profile for ${result.email}`;
    return { ok: true, data: undefined, message: photoNote ? `${added}. ${photoNote}` : added };
  } catch (error) {
    return toActionError(error, "faculty_member_add_failed");
  }
}

/**
 * Saves the picked photo against the new profile. A photo that the storage layer
 * refuses is reported beside the success rather than failing the whole add: the
 * professor is on the list either way, and a picture is the easiest thing to fix
 * afterwards.
 */
async function attachPhoto(photo: FormDataEntryValue | null, userId: string): Promise<string | null> {
  if (!(photo instanceof File) || photo.size === 0) return null;
  try {
    const stored = await storeFile({ file: photo, purpose: "photo", ownerId: userId });
    await setFacultyPhoto(userId, stored.id);
    return null;
  } catch (error) {
    log.error("faculty_photo_failed", { userId, error });
    return error instanceof AppError ? `The photo was not saved: ${error.message}` : "The photo could not be saved.";
  }
}

const MAX_CSV_BYTES = 2 * 1024 * 1024;

export type ImportPreview = {
  headers: string[];
  outcomes: FacultyRowOutcome[];
  csv: string;
  source: string;
};

async function readCsv(formData: FormData): Promise<{ csv: string; source: string } | { error: string }> {
  const source = optionalText(formData, "source") ?? "faculty_list";
  const pasted = optionalText(formData, "csv");
  const file = formData.get("file");

  let csv = pasted ?? "";
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_CSV_BYTES) {
      return { error: "That file is larger than 2 MB. Split the list and import it in parts." };
    }
    csv = await file.text();
  }

  if (csv.trim().length === 0) {
    return { error: "Paste the faculty list, or choose a CSV file." };
  }
  return { csv, source: source.slice(0, 80) };
}

/**
 * Shows what the import would do without writing anything. Faculty lists are
 * long enough that an admin should see the rejected rows before committing,
 * rather than discovering them afterwards in a log.
 */
export async function previewFacultyImportAction(
  _prev: ActionResult<ImportPreview> | null,
  formData: FormData,
): Promise<ActionResult<ImportPreview>> {
  await requireAdmin();

  const read = await readCsv(formData);
  if ("error" in read) return { ok: false, error: read.error };

  try {
    const { headers, outcomes } = await planFacultyImport(read.csv);
    if (outcomes.length === 0) {
      return { ok: false, error: "No rows with an email address were found. Check that the first line is a header." };
    }
    return { ok: true, data: { headers, outcomes, csv: read.csv, source: read.source } };
  } catch (error) {
    return toActionError(error, "faculty_import_preview_failed");
  }
}

export async function applyFacultyImportAction(_prev: ActionResult | null, formData: FormData) {
  const admin = await requireAdmin();

  const read = await readCsv(formData);
  if ("error" in read) return { ok: false as const, error: read.error };

  try {
    const result = await applyFacultyImport(read.csv, { source: read.source });

    await recordAudit({
      actorId: admin.id,
      action: "faculty_imported",
      subjectType: "institution",
      detail: {
        source: read.source,
        created: result.created,
        refreshed: result.refreshed,
        rejected: result.rejected,
      },
    });

    revalidatePath("/admin/faculty");
    revalidatePath("/admin/researchers");

    const parts = [`${result.created} created`, `${result.refreshed} refreshed`];
    if (result.rejected > 0) parts.push(`${result.rejected} skipped`);

    return { ok: true as const, data: undefined, message: parts.join(", ") };
  } catch (error) {
    return toActionError(error, "faculty_import_failed");
  }
}
