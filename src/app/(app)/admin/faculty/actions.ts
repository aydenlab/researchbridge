"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/permissions";
import { optionalText, toActionError } from "@/lib/action-utils";
import type { ActionResult } from "@/lib/errors";
import { recordAudit } from "@/lib/events";
import { addFacultyMember, applyFacultyImport, planFacultyImport, type FacultyRowOutcome } from "@/lib/faculty/import";

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
        labWebsite: text("labWebsite"),
        researchAreas: text("researchAreas"),
        biography: text("biography"),
      },
      { source: "admin_form" },
    );
    if (!result.ok) return { ok: false, error: result.reason };

    await recordAudit({
      actorId: admin.id,
      action: "faculty_member_added",
      subjectType: "institution",
      detail: { email: result.email, created: result.created },
    });

    revalidatePath("/admin/faculty");
    revalidatePath("/admin/researchers");
    return {
      ok: true,
      data: undefined,
      message: result.created ? `Added ${result.email}` : `Updated the existing profile for ${result.email}`,
    };
  } catch (error) {
    return toActionError(error, "faculty_member_add_failed");
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
