"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
  db,
  institutionEmailDomains,
  institutions,
  notifications,
  opportunities,
  researchFields,
  researcherProfiles,
  skills,
  users,
} from "@/db";
import { requireAdmin } from "@/lib/auth/permissions";
import { optionalText, parseForm, toActionError } from "@/lib/action-utils";
import type { ActionResult } from "@/lib/errors";
import { recordAudit, recordEvent } from "@/lib/events";
import { setFlag, type FeatureFlagKey } from "@/lib/flags";
import { slugify } from "@/lib/format";
import { sendResearcherApproved } from "@/lib/email";
import { z } from "zod";

export async function reviewResearcherAction(_prev: ActionResult | null, formData: FormData) {
  const admin = await requireAdmin();
  const researcherId = String(formData.get("researcherId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const notes = optionalText(formData, "notes");

  if (!["verified", "rejected", "needs_review", "pending"].includes(decision)) {
    return { ok: false as const, error: "Choose one of the listed decisions." };
  }

  try {
    const rows = await db
      .select({
        userId: researcherProfiles.userId,
        firstName: researcherProfiles.firstName,
        lastName: researcherProfiles.lastName,
        email: users.email,
        institutionId: users.institutionId,
      })
      .from(researcherProfiles)
      .innerJoin(users, eq(users.id, researcherProfiles.userId))
      .where(eq(researcherProfiles.userId, researcherId))
      .limit(1);

    const researcher = rows[0];
    if (!researcher) return { ok: false as const, error: "That researcher account could not be found." };

    await db
      .update(researcherProfiles)
      .set({
        verificationStatus: decision as "verified" | "rejected" | "needs_review" | "pending",
        verificationNotes: notes,
        approvedAt: decision === "verified" ? new Date() : null,
        approvedBy: decision === "verified" ? admin.id : null,
        updatedAt: new Date(),
      })
      .where(eq(researcherProfiles.userId, researcherId));

    await db.insert(notifications).values({
      userId: researcherId,
      type: "researcher_review",
      title:
        decision === "verified"
          ? "Your researcher account is approved"
          : decision === "rejected"
            ? "Your researcher account was not approved"
            : "A reviewer has asked for clarification",
      body: notes ?? undefined,
      link: decision === "verified" ? "/researcher" : "/researcher/pending",
    });

    if (decision === "verified") {
      await sendResearcherApproved(researcher.email, `${researcher.firstName} ${researcher.lastName}`);
      await recordEvent({
        name: "researcher_verified",
        userId: researcherId,
        institutionId: researcher.institutionId,
        subjectType: "researcher_profile",
        subjectId: researcherId,
      });
    }

    await recordAudit({
      actorId: admin.id,
      action: `researcher_${decision}`,
      subjectType: "researcher_profile",
      subjectId: researcherId,
      detail: { notes },
    });

    revalidatePath("/admin/researchers");
    return { ok: true as const, data: undefined, message: `Marked ${decision.replace("_", " ")}` };
  } catch (error) {
    return toActionError(error, "review_researcher_failed");
  }
}

export async function setAccountStatusAction(_prev: ActionResult | null, formData: FormData) {
  const admin = await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const status = String(formData.get("status") ?? "");

  if (!["active", "suspended", "disabled", "pending"].includes(status)) {
    return { ok: false as const, error: "That account status is not allowed." };
  }
  if (userId === admin.id) {
    return { ok: false as const, error: "You cannot change the status of your own account." };
  }

  try {
    await db
      .update(users)
      .set({ accountStatus: status as "active" | "suspended" | "disabled" | "pending", updatedAt: new Date() })
      .where(eq(users.id, userId));

    await recordAudit({
      actorId: admin.id,
      action: "account_status_changed",
      subjectType: "user",
      subjectId: userId,
      detail: { status },
    });

    revalidatePath("/admin/users");
    return { ok: true as const, data: undefined, message: `Account ${status}` };
  } catch (error) {
    return toActionError(error, "set_account_status_failed");
  }
}

export async function moderateOpportunityAction(_prev: ActionResult | null, formData: FormData) {
  const admin = await requireAdmin();
  const opportunityId = String(formData.get("opportunityId") ?? "");
  const status = String(formData.get("status") ?? "");
  const reason = optionalText(formData, "reason");

  if (!["published", "unpublished", "closed", "archived"].includes(status)) {
    return { ok: false as const, error: "That status change is not allowed." };
  }

  try {
    const rows = await db
      .select({ id: opportunities.id, researcherId: opportunities.researcherId, title: opportunities.title, status: opportunities.status })
      .from(opportunities)
      .where(eq(opportunities.id, opportunityId))
      .limit(1);
    const opportunity = rows[0];
    if (!opportunity) return { ok: false as const, error: "That opportunity could not be found." };

    const now = new Date();
    await db
      .update(opportunities)
      .set({
        status: status as "published" | "unpublished" | "closed" | "archived",
        closedAt: status === "closed" ? now : undefined,
        archivedAt: status === "archived" ? now : undefined,
        updatedAt: now,
      })
      .where(eq(opportunities.id, opportunityId));

    if (status !== "published") {
      await db.insert(notifications).values({
        userId: opportunity.researcherId,
        type: "opportunity_moderated",
        title: `A ResearchBridge administrator ${status} your listing`,
        body: reason ? `${opportunity.title}. ${reason}` : opportunity.title,
        link: "/researcher/opportunities",
      });
    }

    await recordAudit({
      actorId: admin.id,
      action: `admin_opportunity_${status}`,
      subjectType: "opportunity",
      subjectId: opportunityId,
      detail: { reason, previousStatus: opportunity.status },
    });

    revalidatePath("/admin/opportunities");
    revalidatePath("/opportunities");
    return { ok: true as const, data: undefined, message: `Listing ${status}` };
  } catch (error) {
    return toActionError(error, "moderate_opportunity_failed");
  }
}

const blankToNull = (max: number, min = 0) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null))
    .refine((value) => value === null || value.length >= min, {
      message: `Use at least ${min} characters, or leave this blank.`,
    });

const institutionSchema = z.object({
  name: z.string().trim().min(2, "Enter the institution name.").max(160),
  slug: blankToNull(80, 2),
  shortName: blankToNull(80),
  location: blankToNull(160),
  gpaScaleName: blankToNull(80),
  gpaScaleMax: blankToNull(10).refine((value) => value === null || Number.isFinite(Number(value)), {
    message: "Enter a number, for example 12, or leave this blank.",
  }),
  domains: blankToNull(600),
  active: z.coerce.boolean().default(true),
  isPilot: z.coerce.boolean().default(false),
});

export async function upsertInstitutionAction(_prev: ActionResult | null, formData: FormData) {
  const admin = await requireAdmin();
  const parsed = parseForm(institutionSchema, formData);
  if (!parsed.ok) return parsed.result;
  const institutionId = optionalText(formData, "institutionId");

  try {
    const slug = parsed.data.slug ? slugify(parsed.data.slug) : slugify(parsed.data.name);
    const values = {
      name: parsed.data.name,
      slug,
      shortName: parsed.data.shortName,
      location: parsed.data.location,
      gpaScaleName: parsed.data.gpaScaleName,
      gpaScaleMax: parsed.data.gpaScaleMax,
      active: parsed.data.active,
      isPilot: parsed.data.isPilot,
      updatedAt: new Date(),
    };

    let id = institutionId;
    if (id) {
      await db.update(institutions).set(values).where(eq(institutions.id, id));
    } else {
      const [row] = await db.insert(institutions).values(values).returning({ id: institutions.id });
      id = row.id;
    }

    const domains = (parsed.data.domains ?? "")
      .split(/[\s,]+/)
      .map((value) => value.trim().toLowerCase().replace(/^@/, ""))
      .filter(Boolean);

    if (domains.length > 0) {
      await db.delete(institutionEmailDomains).where(eq(institutionEmailDomains.institutionId, id));
      for (const domain of domains) {
        await db
          .insert(institutionEmailDomains)
          .values({ institutionId: id, domain })
          .onConflictDoNothing();
      }
    }

    await recordAudit({
      actorId: admin.id,
      action: institutionId ? "institution_updated" : "institution_created",
      subjectType: "institution",
      subjectId: id,
    });

    revalidatePath("/admin/institutions");
    return { ok: true as const, data: undefined, message: institutionId ? "Institution updated" : "Institution created" };
  } catch (error) {
    return toActionError(error, "upsert_institution_failed");
  }
}

export async function addTaxonomyEntryAction(_prev: ActionResult | null, formData: FormData) {
  const admin = await requireAdmin();
  const kind = String(formData.get("kind") ?? "");
  const name = optionalText(formData, "name");
  const category = optionalText(formData, "category");

  if (!name) return { ok: false as const, error: "Enter a name." };
  if (!["skill", "field"].includes(kind)) return { ok: false as const, error: "Unknown taxonomy." };

  try {
    if (kind === "skill") {
      await db
        .insert(skills)
        .values({ name, slug: slugify(name), category, approved: true })
        .onConflictDoNothing();
    } else {
      await db.insert(researchFields).values({ name, slug: slugify(name) }).onConflictDoNothing();
    }

    await recordAudit({ actorId: admin.id, action: `${kind}_added`, subjectType: kind, detail: { name } });
    revalidatePath("/admin/taxonomies");
    return { ok: true as const, data: undefined, message: `${name} added` };
  } catch (error) {
    return toActionError(error, "add_taxonomy_failed");
  }
}

export async function setSkillApprovalAction(_prev: ActionResult | null, formData: FormData) {
  const admin = await requireAdmin();
  const skillId = String(formData.get("skillId") ?? "");
  const approved = formData.get("approved") === "true";

  try {
    await db.update(skills).set({ approved }).where(eq(skills.id, skillId));
    await recordAudit({ actorId: admin.id, action: "skill_approval_changed", subjectType: "skill", subjectId: skillId, detail: { approved } });
    revalidatePath("/admin/taxonomies");
    return { ok: true as const, data: undefined, message: approved ? "Skill approved" : "Skill hidden" };
  } catch (error) {
    return toActionError(error, "set_skill_approval_failed");
  }
}

export async function toggleFeatureFlagAction(_prev: ActionResult | null, formData: FormData) {
  const admin = await requireAdmin();
  const key = String(formData.get("key") ?? "") as FeatureFlagKey;
  const enabled = formData.get("enabled") === "true";

  const allowed: FeatureFlagKey[] = [
    "AI_ANALYSIS_ENABLED",
    "VIDEO_RESPONSES_ENABLED",
    "WAITLIST_ENABLED",
    "PUBLIC_SIGNUP_ENABLED",
    "RESEARCHER_SIGNUP_ENABLED",
  ];
  if (!allowed.includes(key)) return { ok: false as const, error: "Unknown feature flag." };

  try {
    await setFlag(key, enabled);
    await recordAudit({ actorId: admin.id, action: "feature_flag_changed", subjectType: "feature_flag", detail: { key, enabled } });
    revalidatePath("/admin/system");
    return { ok: true as const, data: undefined, message: `${key} ${enabled ? "enabled" : "disabled"}` };
  } catch (error) {
    return toActionError(error, "toggle_feature_flag_failed");
  }
}
