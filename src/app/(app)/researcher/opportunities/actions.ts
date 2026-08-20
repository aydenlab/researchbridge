"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  applications,
  db,
  notifications,
  opportunities,
  opportunityCriteria,
  opportunityFields,
  opportunityQuestions,
  opportunityResearchMaterials,
  opportunitySkills,
} from "@/db";
import { requireApprovedResearcher, requireManagedOpportunity } from "@/lib/auth/permissions";
import { checkboxValue, formList, optionalText, parseForm, toActionError } from "@/lib/action-utils";
import type { ActionResult } from "@/lib/errors";
import { recordAudit, recordEvent } from "@/lib/events";
import { slugify } from "@/lib/format";
import { log } from "@/lib/log";
import { ensureSkill } from "@/lib/queries/taxonomy";
import {
  DEFAULT_PAPER_PROMPT,
  logisticsStepSchema,
  paperStepSchema,
  projectStepSchema,
  roleStepSchema,
  videoStepSchema,
} from "@/lib/validation/opportunity";

const TOTAL_STEPS = 9;

async function uniqueSlug(title: string, opportunityId: string): Promise<string> {
  const base = slugify(title) || "research-position";
  let candidate = base;
  let counter = 1;
  while (true) {
    const rows = await db
      .select({ id: opportunities.id })
      .from(opportunities)
      .where(eq(opportunities.slug, candidate))
      .limit(1);
    if (!rows[0] || rows[0].id === opportunityId) return candidate;
    counter += 1;
    candidate = `${base}-${counter}`;
  }
}

export async function createDraftAction(_prev: ActionResult | null, _formData: FormData) {
  const user = await requireApprovedResearcher();
  let id = "";

  try {
    if (!user.institutionId) {
      return { ok: false as const, error: "Your account is not linked to an institution. Contact hello@myresearchbridge.com." };
    }
    const [row] = await db
      .insert(opportunities)
      .values({
        institutionId: user.institutionId,
        researcherId: user.id,
        title: "Untitled research position",
        slug: `draft-${crypto.randomUUID().slice(0, 12)}`,
        summary: "",
        status: "draft",
        draftStep: 1,
      })
      .returning({ id: opportunities.id });
    id = row.id;

    await recordEvent({
      name: "opportunity_created",
      userId: user.id,
      institutionId: user.institutionId,
      subjectType: "opportunity",
      subjectId: id,
    });
  } catch (error) {
    return toActionError(error, "create_draft_failed");
  }

  redirect(`/researcher/opportunities/${id}/edit?step=1`);
}

async function advance(opportunityId: string, step: number) {
  const next = Math.min(step + 1, TOTAL_STEPS);
  await db
    .update(opportunities)
    .set({ draftStep: sql`greatest(${opportunities.draftStep}, ${next})`, updatedAt: new Date() })
    .where(eq(opportunities.id, opportunityId));
  return next;
}

export async function saveProjectStepAction(_prev: ActionResult | null, formData: FormData) {
  const opportunityId = String(formData.get("opportunityId") ?? "");
  const parsed = parseForm(projectStepSchema, formData);
  if (!parsed.ok) return parsed.result;

  try {
    const { opportunity } = await requireManagedOpportunity(opportunityId);
    const slug = await uniqueSlug(parsed.data.title, opportunityId);

    await db
      .update(opportunities)
      .set({
        title: parsed.data.title,
        slug,
        summary: parsed.data.summary,
        description: parsed.data.description,
        projectGoals: parsed.data.projectGoals,
        department: parsed.data.department,
        labName: parsed.data.labName,
        updatedAt: new Date(),
      })
      .where(eq(opportunities.id, opportunity.id));

    await db.delete(opportunityFields).where(eq(opportunityFields.opportunityId, opportunity.id));
    await db
      .insert(opportunityFields)
      .values(parsed.data.researchFieldIds.map((researchFieldId) => ({ opportunityId: opportunity.id, researchFieldId })));

    await advance(opportunity.id, 1);
  } catch (error) {
    return toActionError(error, "save_project_step_failed");
  }

  redirect(`/researcher/opportunities/${opportunityId}/edit?step=2`);
}

export async function saveRoleStepAction(_prev: ActionResult | null, formData: FormData) {
  const opportunityId = String(formData.get("opportunityId") ?? "");
  const parsed = parseForm(roleStepSchema, formData);
  if (!parsed.ok) return parsed.result;

  try {
    const { opportunity } = await requireManagedOpportunity(opportunityId);
    await db
      .update(opportunities)
      .set({
        responsibilities: parsed.data.responsibilities,
        techniques: parsed.data.techniques,
        expectedOutputs: parsed.data.expectedOutputs,
        learningOpportunities: parsed.data.learningOpportunities,
        updatedAt: new Date(),
      })
      .where(eq(opportunities.id, opportunity.id));
    await advance(opportunity.id, 2);
  } catch (error) {
    return toActionError(error, "save_role_step_failed");
  }

  redirect(`/researcher/opportunities/${opportunityId}/edit?step=3`);
}

export async function saveLogisticsStepAction(_prev: ActionResult | null, formData: FormData) {
  const opportunityId = String(formData.get("opportunityId") ?? "");
  const parsed = parseForm(logisticsStepSchema, formData);
  if (!parsed.ok) return parsed.result;

  try {
    const { opportunity } = await requireManagedOpportunity(opportunityId);
    await db
      .update(opportunities)
      .set({
        numberOfOpenings: parsed.data.numberOfOpenings,
        startDate: parsed.data.startDate,
        duration: parsed.data.duration,
        hoursPerWeekMin: parsed.data.hoursPerWeekMin,
        hoursPerWeekMax: parsed.data.hoursPerWeekMax,
        deadline: parsed.data.deadline,
        locationMode: parsed.data.locationMode,
        location: parsed.data.location,
        compensationType: parsed.data.compensationType,
        compensationDetails: parsed.data.compensationDetails,
        academicCreditAvailable: parsed.data.academicCreditAvailable,
        beginnerFriendly: parsed.data.beginnerFriendly,
        priorResearchRequired: parsed.data.priorResearchRequired,
        updatedAt: new Date(),
      })
      .where(eq(opportunities.id, opportunity.id));
    await advance(opportunity.id, 3);
  } catch (error) {
    return toActionError(error, "save_logistics_step_failed");
  }

  redirect(`/researcher/opportunities/${opportunityId}/edit?step=4`);
}

export async function saveCriteriaStepAction(_prev: ActionResult | null, formData: FormData) {
  const opportunityId = String(formData.get("opportunityId") ?? "");

  try {
    const { opportunity } = await requireManagedOpportunity(opportunityId);

    const types = formData.getAll("criterionType").map(String);
    const labels = formData.getAll("criterionLabel").map(String);
    const descriptions = formData.getAll("criterionDescription").map(String);
    const importances = formData.getAll("criterionImportance").map(String);
    const configValues = formData.getAll("criterionConfig").map(String);

    const rows: (typeof opportunityCriteria.$inferInsert)[] = [];

    for (let index = 0; index < labels.length; index += 1) {
      const label = labels[index]?.trim();
      if (!label) continue;
      const type = types[index] as (typeof opportunityCriteria.$inferInsert)["type"];
      const importance = (importances[index] ?? "medium") as "required" | "high" | "medium" | "low";
      const raw = configValues[index]?.trim() ?? "";

      let config: Record<string, unknown> = {};
      if (type === "availability") {
        const hours = Number.parseInt(raw, 10);
        config = Number.isFinite(hours) ? { minHoursPerWeek: hours } : {};
      } else if (type === "coursework") {
        config = { courseCodes: raw.split(",").map((value) => value.trim().toUpperCase()).filter(Boolean) };
      } else if (type === "program") {
        config = { programs: raw.split(",").map((value) => value.trim()).filter(Boolean) };
      } else if (type === "year_level") {
        const minYear = Number.parseInt(raw, 10);
        config = Number.isFinite(minYear) ? { minYear } : {};
      } else if (type === "skill") {
        const name = raw || label;
        config = { skillSlug: slugify(name), skillName: name };
        await ensureSkill(name);
      } else if (type === "research_interest") {
        config = { fieldSlugs: raw.split(",").map((value) => slugify(value)).filter(Boolean) };
      } else if (type === "prior_research") {
        const minimum = Number.parseInt(raw, 10);
        config = { minExperiences: Number.isFinite(minimum) ? minimum : 1 };
      } else if (type === "technique") {
        config = { keywords: raw.split(",").map((value) => value.trim()).filter(Boolean) };
      } else if (type === "academic_metric") {
        const value = Number.parseFloat(raw);
        config = Number.isFinite(value) ? { minValue: value, metricType: "institution_scale", scaleMax: 12 } : {};
      }

      rows.push({
        opportunityId: opportunity.id,
        type,
        label: label.slice(0, 180),
        description: descriptions[index]?.trim() || null,
        required: importance === "required",
        importance,
        config,
        sortOrder: index,
      });
    }

    const skillNames = formList(formData, "opportunitySkillName");
    const skillLevels = formData.getAll("opportunitySkillLevel").map(String);

    await db.transaction(async (tx) => {
      await tx.delete(opportunityCriteria).where(eq(opportunityCriteria.opportunityId, opportunity.id));
      if (rows.length > 0) await tx.insert(opportunityCriteria).values(rows);
    });

    await db.delete(opportunitySkills).where(eq(opportunitySkills.opportunityId, opportunity.id));
    const seen = new Set<string>();
    const skillRows: { opportunityId: string; skillId: string; requirementLevel: "required" | "preferred" | "not_required" }[] = [];
    for (let index = 0; index < skillNames.length; index += 1) {
      const skillId = await ensureSkill(skillNames[index]);
      if (seen.has(skillId)) continue;
      seen.add(skillId);
      const level = skillLevels[index];
      skillRows.push({
        opportunityId: opportunity.id,
        skillId,
        requirementLevel: ["required", "preferred", "not_required"].includes(level)
          ? (level as "required" | "preferred" | "not_required")
          : "preferred",
      });
    }
    if (skillRows.length > 0) await db.insert(opportunitySkills).values(skillRows);

    await advance(opportunity.id, 4);
  } catch (error) {
    return toActionError(error, "save_criteria_step_failed");
  }

  redirect(`/researcher/opportunities/${opportunityId}/edit?step=5`);
}

export async function saveQuestionsStepAction(_prev: ActionResult | null, formData: FormData) {
  const opportunityId = String(formData.get("opportunityId") ?? "");

  try {
    const { opportunity } = await requireManagedOpportunity(opportunityId);

    const types = formData.getAll("questionType").map(String);
    const prompts = formData.getAll("questionPrompt").map(String);
    const helpTexts = formData.getAll("questionHelp").map(String);
    const requiredFlags = formData.getAll("questionRequired").map(String);
    const options = formData.getAll("questionOptions").map(String);
    const maxLengths = formData.getAll("questionMaxLength").map(String);

    const existing = await db
      .select()
      .from(opportunityQuestions)
      .where(eq(opportunityQuestions.opportunityId, opportunity.id));
    const paperQuestion = existing.find((question) => question.type === "paper_response");

    const rows: (typeof opportunityQuestions.$inferInsert)[] = [];
    for (let index = 0; index < prompts.length; index += 1) {
      const prompt = prompts[index]?.trim();
      if (!prompt) continue;
      const type = types[index] as (typeof opportunityQuestions.$inferInsert)["type"];
      const config: Record<string, unknown> = {};
      if (type === "multiple_choice") {
        config.options = options[index]?.split(",").map((value) => value.trim()).filter(Boolean) ?? [];
      }
      const maxLength = Number.parseInt(maxLengths[index] ?? "", 10);
      if (Number.isFinite(maxLength) && (type === "long_text" || type === "short_text" || type === "paper_response")) {
        config.maxLength = maxLength;
      }
      rows.push({
        opportunityId: opportunity.id,
        type,
        prompt: prompt.slice(0, 600),
        helpText: helpTexts[index]?.trim() || null,
        required: requiredFlags[index] !== "false",
        config,
        sortOrder: index,
      });
    }

    if (paperQuestion) {
      rows.push({
        opportunityId: opportunity.id,
        type: "paper_response",
        prompt: paperQuestion.prompt,
        helpText: paperQuestion.helpText,
        required: paperQuestion.required,
        config: paperQuestion.config,
        sortOrder: rows.length,
      });
    }

    await db.transaction(async (tx) => {
      await tx.delete(opportunityQuestions).where(eq(opportunityQuestions.opportunityId, opportunity.id));
      if (rows.length > 0) await tx.insert(opportunityQuestions).values(rows);
    });

    await advance(opportunity.id, 5);
  } catch (error) {
    return toActionError(error, "save_questions_step_failed");
  }

  redirect(`/researcher/opportunities/${opportunityId}/edit?step=6`);
}

export async function savePaperStepAction(_prev: ActionResult | null, formData: FormData) {
  const opportunityId = String(formData.get("opportunityId") ?? "");
  const parsed = parseForm(paperStepSchema, formData);
  if (!parsed.ok) return parsed.result;

  try {
    const { opportunity } = await requireManagedOpportunity(opportunityId);

    await db.delete(opportunityResearchMaterials).where(eq(opportunityResearchMaterials.opportunityId, opportunity.id));

    if (parsed.data.materialTitle) {
      await db.insert(opportunityResearchMaterials).values({
        opportunityId: opportunity.id,
        type: "publication",
        title: parsed.data.materialTitle,
        authors: parsed.data.materialAuthors,
        url: parsed.data.materialUrl,
        doi: parsed.data.materialDoi,
        abstract: parsed.data.materialAbstract,
        context: parsed.data.materialContext,
        sortOrder: 0,
      });
    }

    const existing = await db
      .select()
      .from(opportunityQuestions)
      .where(and(eq(opportunityQuestions.opportunityId, opportunity.id), eq(opportunityQuestions.type, "paper_response")));

    if (parsed.data.includePaperQuestion && parsed.data.materialTitle) {
      const prompt = parsed.data.paperPrompt ?? DEFAULT_PAPER_PROMPT;
      if (existing[0]) {
        await db
          .update(opportunityQuestions)
          .set({ prompt, config: { maxLength: 3000 } })
          .where(eq(opportunityQuestions.id, existing[0].id));
      } else {
        const [{ count }] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(opportunityQuestions)
          .where(eq(opportunityQuestions.opportunityId, opportunity.id));
        await db.insert(opportunityQuestions).values({
          opportunityId: opportunity.id,
          type: "paper_response",
          prompt,
          helpText: "There is no correct answer. The researcher wants to see how you read a paper.",
          required: true,
          config: { maxLength: 3000 },
          sortOrder: count,
        });
      }
    } else if (existing[0]) {
      await db.delete(opportunityQuestions).where(eq(opportunityQuestions.id, existing[0].id));
    }

    await advance(opportunity.id, 6);
  } catch (error) {
    return toActionError(error, "save_paper_step_failed");
  }

  redirect(`/researcher/opportunities/${opportunityId}/edit?step=7`);
}

export async function saveVideoStepAction(_prev: ActionResult | null, formData: FormData) {
  const opportunityId = String(formData.get("opportunityId") ?? "");
  const parsed = parseForm(videoStepSchema, formData);
  if (!parsed.ok) return parsed.result;

  try {
    const { opportunity } = await requireManagedOpportunity(opportunityId);
    await db
      .update(opportunities)
      .set({
        videoResponseEnabled: parsed.data.videoResponseEnabled,
        videoPrompt: parsed.data.videoPrompt,
        videoMaxSeconds: parsed.data.videoMaxSeconds,
        updatedAt: new Date(),
      })
      .where(eq(opportunities.id, opportunity.id));

    const existing = await db
      .select()
      .from(opportunityQuestions)
      .where(and(eq(opportunityQuestions.opportunityId, opportunity.id), eq(opportunityQuestions.type, "video_response")));

    if (parsed.data.videoResponseEnabled) {
      const prompt = parsed.data.videoPrompt ?? "Record a short introduction describing why this project interests you.";
      if (existing[0]) {
        await db.update(opportunityQuestions).set({ prompt }).where(eq(opportunityQuestions.id, existing[0].id));
      } else {
        const [{ count }] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(opportunityQuestions)
          .where(eq(opportunityQuestions.opportunityId, opportunity.id));
        await db.insert(opportunityQuestions).values({
          opportunityId: opportunity.id,
          type: "video_response",
          prompt,
          helpText: "Record it wherever you like and paste a link the researcher can open.",
          required: false,
          config: { maxSeconds: parsed.data.videoMaxSeconds },
          sortOrder: count,
        });
      }
    } else if (existing[0]) {
      await db.delete(opportunityQuestions).where(eq(opportunityQuestions.id, existing[0].id));
    }

    await advance(opportunity.id, 7);
  } catch (error) {
    return toActionError(error, "save_video_step_failed");
  }

  redirect(`/researcher/opportunities/${opportunityId}/edit?step=8`);
}

export async function publishOpportunityAction(_prev: ActionResult | null, formData: FormData) {
  const opportunityId = String(formData.get("opportunityId") ?? "");
  if (!checkboxValue(formData, "confirm")) {
    return { ok: false as const, error: "Confirm that the listing is accurate before publishing." };
  }

  try {
    const { user, opportunity } = await requireManagedOpportunity(opportunityId);

    const problems: string[] = [];
    if (!opportunity.title || opportunity.title === "Untitled research position") problems.push("a project title");
    if (!opportunity.summary) problems.push("a plain-language summary");
    if (!opportunity.description) problems.push("a research description");
    if (!opportunity.responsibilities) problems.push("student responsibilities");
    if (opportunity.hoursPerWeekMin === null) problems.push("expected hours per week");
    if (!opportunity.deadline) problems.push("an application deadline");
    if (!opportunity.department) problems.push("a department");

    if (problems.length > 0) {
      return {
        ok: false as const,
        error: `This listing still needs ${problems.join(", ")}. Listings without these are not published.`,
      };
    }

    const now = new Date();
    await db.transaction(async (tx) => {
      await tx
        .update(opportunities)
        .set({ status: "published", publishedAt: opportunity.publishedAt ?? now, draftStep: TOTAL_STEPS, updatedAt: now })
        .where(eq(opportunities.id, opportunity.id));
    });

    await recordEvent({
      name: "opportunity_published",
      userId: user.id,
      institutionId: opportunity.institutionId,
      subjectType: "opportunity",
      subjectId: opportunity.id,
    });
    await recordAudit({
      actorId: user.id,
      action: "opportunity_published",
      subjectType: "opportunity",
      subjectId: opportunity.id,
    });

    revalidatePath("/opportunities");
    revalidatePath("/researcher/opportunities");
    log.info("opportunity_published", { opportunityId: opportunity.id });
  } catch (error) {
    return toActionError(error, "publish_opportunity_failed");
  }

  redirect(`/researcher/opportunities/${opportunityId}/applicants?published=1`);
}

export async function changeOpportunityStatusAction(_prev: ActionResult | null, formData: FormData) {
  const opportunityId = String(formData.get("opportunityId") ?? "");
  const target = String(formData.get("status") ?? "");

  if (!["published", "closed", "unpublished", "archived"].includes(target)) {
    return { ok: false as const, error: "That status change is not allowed." };
  }

  try {
    const { user, opportunity } = await requireManagedOpportunity(opportunityId);

    if (target === "archived") {
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(applications)
        .where(and(eq(applications.opportunityId, opportunity.id), sql`${applications.status} <> 'draft'`));
      if (count > 0 && opportunity.status !== "closed") {
        return {
          ok: false as const,
          error: "Close this position before archiving it. Applications are preserved either way.",
        };
      }
    }

    const now = new Date();
    await db
      .update(opportunities)
      .set({
        status: target as "published" | "closed" | "unpublished" | "archived",
        closedAt: target === "closed" ? now : opportunity.closedAt,
        archivedAt: target === "archived" ? now : opportunity.archivedAt,
        publishedAt: target === "published" ? (opportunity.publishedAt ?? now) : opportunity.publishedAt,
        updatedAt: now,
      })
      .where(eq(opportunities.id, opportunity.id));

    await recordAudit({
      actorId: user.id,
      action: `opportunity_${target}`,
      subjectType: "opportunity",
      subjectId: opportunity.id,
      detail: { previousStatus: opportunity.status },
    });

    if (target === "closed") {
      const openApplications = await db
        .select({ id: applications.id, studentId: applications.studentId })
        .from(applications)
        .where(and(eq(applications.opportunityId, opportunity.id), sql`${applications.status} in ('submitted','under_review','shortlisted')`));

      if (openApplications.length > 0) {
        await db.insert(notifications).values(
          openApplications.map((application) => ({
            userId: application.studentId,
            type: "opportunity_closed",
            title: "A position you applied to has closed",
            body: `${opportunity.title} is no longer accepting applications.`,
            link: `/applications/${application.id}`,
          })),
        );
      }
    }

    revalidatePath("/researcher/opportunities");
    revalidatePath("/opportunities");
    return { ok: true as const, data: undefined, message: `Position ${target}` };
  } catch (error) {
    return toActionError(error, "change_opportunity_status_failed");
  }
}
