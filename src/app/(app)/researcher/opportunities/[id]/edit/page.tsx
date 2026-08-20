import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { OnboardingShell, type Step } from "@/components/app/onboarding-shell";
import { Badge, Tag } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { requireApprovedResearcher, canManageOpportunity } from "@/lib/auth/permissions";
import { IMPORTANCE_LABEL } from "@/lib/criteria/weights";
import { isEnabled } from "@/lib/flags";
import { deadlineNote, formatDate, hoursLabel } from "@/lib/format";
import {
  COMPENSATION_LABELS,
  CRITERION_TYPE_LABELS,
  LOCATION_LABELS,
  PAID_COMPENSATION,
  QUESTION_TYPE_LABELS,
  labelOr,
} from "@/lib/labels";
import { loadOpportunityDetail } from "@/lib/queries/opportunities";
import { listDepartments, listResearchFields, listSkills } from "@/lib/queries/taxonomy";
import { CriteriaStep, LogisticsStep, PaperStep, ProjectStep, PublishStep, QuestionsStep, RoleStep, VideoStep } from "./step-forms";

export const metadata: Metadata = {
  title: "Edit opportunity",
  robots: { index: false, follow: false },
};

const STEPS: Step[] = [
  { number: 1, label: "Research project", description: "The project itself, in language a second-year student can follow." },
  { number: 2, label: "Student role", description: "What the student would actually spend their time doing." },
  { number: 3, label: "Logistics", description: "Openings, hours, dates, location, and compensation." },
  { number: 4, label: "Candidate criteria", description: "What matters for this project, and how much each item counts." },
  { number: 5, label: "Application questions", description: "Questions written for this project rather than a generic form." },
  { number: 6, label: "Research paper", description: "Optionally attach a paper and ask applicants to respond to it." },
  { number: 7, label: "Video response", description: "Optional. Off by default and never a platform requirement." },
  { number: 8, label: "Preview", description: "Exactly what a student sees before they apply." },
  { number: 9, label: "Publish", description: "Confirm and make the listing live." },
];

function configToInput(type: string, config: Record<string, unknown>): string {
  if (type === "availability") return String(config.minHoursPerWeek ?? "");
  if (type === "coursework") return ((config.courseCodes as string[]) ?? []).join(", ");
  if (type === "program") return ((config.programs as string[]) ?? []).join(", ");
  if (type === "year_level") return String(config.minYear ?? "");
  if (type === "skill") return String(config.skillName ?? "");
  if (type === "research_interest") return ((config.fieldSlugs as string[]) ?? []).join(", ");
  if (type === "prior_research") return String(config.minExperiences ?? "1");
  if (type === "technique") return ((config.keywords as string[]) ?? []).join(", ");
  if (type === "academic_metric") return String(config.minValue ?? "");
  return "";
}

export default async function EditOpportunityPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ step?: string }>;
}) {
  const { id } = await params;
  const user = await requireApprovedResearcher();
  if (!(await canManageOpportunity(user, id))) notFound();

  const detail = await loadOpportunityDetail(id);
  if (!detail) notFound();
  if (detail.opportunity.status === "archived") redirect("/researcher/opportunities");

  const { step: stepParam } = await searchParams;
  const furthest = Math.max(1, Math.min(detail.opportunity.draftStep, STEPS.length));
  const requested = Number(stepParam ?? furthest);
  const step = Number.isFinite(requested) ? Math.min(Math.max(Math.round(requested), 1), STEPS.length) : furthest;

  const [fields, departments, skillOptions, videoFeature] = await Promise.all([
    listResearchFields(),
    user.institutionId ? listDepartments(user.institutionId) : Promise.resolve([]),
    listSkills(),
    isEnabled("VIDEO_RESPONSES_ENABLED"),
  ]);

  const material = detail.materials[0];
  const paperQuestion = detail.questions.find((question) => question.type === "paper_response");
  const openQuestions = detail.questions.filter(
    (question) => question.type !== "paper_response" && question.type !== "video_response",
  );

  const deadline = deadlineNote(detail.opportunity.deadline);
  const paid = PAID_COMPENSATION.has(detail.opportunity.compensationType);
  const required = detail.criteria.filter((criterion) => criterion.required);
  const preferred = detail.criteria.filter((criterion) => !criterion.required);

  return (
    <OnboardingShell
      title={detail.opportunity.status === "published" ? "Edit published listing" : "New research position"}
      intro="Everything saves as you go. A draft is visible only to you until you publish it."
      steps={STEPS}
      current={step}
      basePath={`/researcher/opportunities/${id}/edit`}
      furthest={furthest}
    >
      {step === 1 ? (
        <ProjectStep
          id={id}
          draft={{
            title: detail.opportunity.title,
            summary: detail.opportunity.summary,
            description: detail.opportunity.description ?? "",
            projectGoals: detail.opportunity.projectGoals ?? "",
            department: detail.opportunity.department ?? "",
            labName: detail.opportunity.labName ?? "",
          }}
          fields={fields.map((field) => ({ id: field.id, name: field.name }))}
          selectedFieldIds={detail.fields.map((field) => field.id)}
          departments={departments.map((department) => department.name)}
        />
      ) : null}

      {step === 2 ? (
        <RoleStep
          id={id}
          draft={{
            responsibilities: detail.opportunity.responsibilities ?? "",
            techniques: detail.opportunity.techniques ?? "",
            expectedOutputs: detail.opportunity.expectedOutputs ?? "",
            learningOpportunities: detail.opportunity.learningOpportunities ?? "",
          }}
        />
      ) : null}

      {step === 3 ? (
        <LogisticsStep
          id={id}
          draft={{
            numberOfOpenings: detail.opportunity.numberOfOpenings,
            startDate: detail.opportunity.startDate ?? "",
            duration: detail.opportunity.duration ?? "",
            hoursPerWeekMin: detail.opportunity.hoursPerWeekMin === null ? "" : String(detail.opportunity.hoursPerWeekMin),
            hoursPerWeekMax: detail.opportunity.hoursPerWeekMax === null ? "" : String(detail.opportunity.hoursPerWeekMax),
            deadline: detail.opportunity.deadline ?? "",
            locationMode: detail.opportunity.locationMode,
            location: detail.opportunity.location ?? "",
            compensationType: detail.opportunity.compensationType,
            compensationDetails: detail.opportunity.compensationDetails ?? "",
            academicCreditAvailable: detail.opportunity.academicCreditAvailable,
            beginnerFriendly: detail.opportunity.beginnerFriendly,
            priorResearchRequired: detail.opportunity.priorResearchRequired,
          }}
        />
      ) : null}

      {step === 4 ? (
        <CriteriaStep
          id={id}
          criteria={detail.criteria.map((criterion) => ({
            type: criterion.type,
            label: criterion.label,
            description: criterion.description ?? "",
            importance: criterion.required ? "required" : criterion.importance,
            configValue: configToInput(criterion.type, criterion.config),
          }))}
          skills={detail.skills.map((skill) => ({ name: skill.name, level: skill.requirementLevel }))}
          skillSuggestions={skillOptions.map((skill) => skill.name)}
        />
      ) : null}

      {step === 5 ? (
        <QuestionsStep
          id={id}
          questions={openQuestions.map((question) => ({
            type: question.type,
            prompt: question.prompt,
            helpText: question.helpText ?? "",
            required: question.required,
            options: ((question.config.options as string[]) ?? []).join(", "),
            maxLength: String(question.config.maxLength ?? 2000),
          }))}
        />
      ) : null}

      {step === 6 ? (
        <PaperStep
          id={id}
          draft={{
            materialTitle: material?.title ?? "",
            materialAuthors: material?.authors ?? "",
            materialUrl: material?.url ?? "",
            materialDoi: material?.doi ?? "",
            materialAbstract: material?.abstract ?? "",
            materialContext: material?.context ?? "",
            paperPrompt: paperQuestion?.prompt ?? "",
            includePaperQuestion: Boolean(paperQuestion),
          }}
        />
      ) : null}

      {step === 7 ? (
        <VideoStep
          id={id}
          draft={{
            videoResponseEnabled: detail.opportunity.videoResponseEnabled,
            videoPrompt: detail.opportunity.videoPrompt ?? "",
            videoMaxSeconds: detail.opportunity.videoMaxSeconds ?? 60,
          }}
          featureEnabled={videoFeature}
        />
      ) : null}

      {step === 8 ? (
        <div className="flex flex-col gap-5">
          <p className="rounded-[8px] border border-line bg-shell px-3 py-2.5 text-[12.5px] leading-5 text-muted">
            This is the student-facing listing exactly as it will appear.
          </p>

          <article className="rounded-[12px] border border-line bg-white p-5">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge tone={paid ? "forest" : "neutral"}>{labelOr(COMPENSATION_LABELS, detail.opportunity.compensationType)}</Badge>
              {detail.opportunity.beginnerFriendly ? <Badge tone="gold">Accepting beginners</Badge> : null}
              <Badge tone="outline">{deadline.text}</Badge>
            </div>

            <h2 className="mt-3 font-display text-[26px] leading-tight text-ink" style={{ letterSpacing: "-0.5px" }}>
              {detail.opportunity.title}
            </h2>
            <p className="mt-1.5 text-[13.5px] text-muted">
              {detail.researcher.title ? `${detail.researcher.title} ` : ""}
              {detail.researcher.firstName} {detail.researcher.lastName}
              {detail.opportunity.department ? `, ${detail.opportunity.department}` : ""}
            </p>

            <p className="mt-4 text-[15px] font-medium leading-7 text-ink">{detail.opportunity.summary}</p>

            <dl className="mt-4 grid gap-x-6 gap-y-2 border-y border-line py-4 sm:grid-cols-2">
              {[
                { label: "Time commitment", value: hoursLabel(detail.opportunity.hoursPerWeekMin, detail.opportunity.hoursPerWeekMax) },
                { label: "Location", value: labelOr(LOCATION_LABELS, detail.opportunity.locationMode) },
                { label: "Expected start", value: formatDate(detail.opportunity.startDate) },
                { label: "Duration", value: detail.opportunity.duration ?? "Not specified" },
                { label: "Openings", value: String(detail.opportunity.numberOfOpenings) },
                { label: "Deadline", value: formatDate(detail.opportunity.deadline) },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between gap-3">
                  <dt className="text-[12.5px] text-muted">{item.label}</dt>
                  <dd className="text-[12.5px] font-medium text-ink">{item.value}</dd>
                </div>
              ))}
            </dl>

            {detail.opportunity.description ? (
              <div className="mt-4">
                <p className="text-[12px] font-medium uppercase tracking-[0.1em] text-subtle">Research overview</p>
                <p className="mt-1.5 whitespace-pre-line text-[14px] leading-7 text-muted">{detail.opportunity.description}</p>
              </div>
            ) : null}

            {detail.opportunity.responsibilities ? (
              <div className="mt-4">
                <p className="text-[12px] font-medium uppercase tracking-[0.1em] text-subtle">What the student would do</p>
                <p className="mt-1.5 whitespace-pre-line text-[14px] leading-7 text-muted">{detail.opportunity.responsibilities}</p>
              </div>
            ) : null}

            {required.length > 0 || preferred.length > 0 ? (
              <div className="mt-5">
                <p className="text-[12px] font-medium uppercase tracking-[0.1em] text-subtle">Criteria students will see</p>
                <ul className="mt-2 flex flex-col gap-1.5">
                  {[...required, ...preferred].map((criterion) => (
                    <li key={criterion.id} className="flex flex-wrap items-center justify-between gap-2 rounded-[8px] border border-line px-3 py-2">
                      <span className="text-[13.5px] text-ink">{criterion.label}</span>
                      <span className="flex items-center gap-2">
                        <span className="text-[11px] uppercase tracking-[0.08em] text-subtle">
                          {labelOr(CRITERION_TYPE_LABELS, criterion.type)}
                        </span>
                        <Badge tone={criterion.required ? "forest" : "outline"}>
                          {criterion.required ? "Required" : IMPORTANCE_LABEL[criterion.importance]}
                        </Badge>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="mt-5 rounded-[8px] border border-[#e6d7ae] bg-gold-soft px-3 py-2.5 text-[13px] text-warn">
                No criteria are set. Applications will arrive without structured evidence to review against.
              </p>
            )}

            {detail.questions.length > 0 ? (
              <div className="mt-5">
                <p className="text-[12px] font-medium uppercase tracking-[0.1em] text-subtle">Application questions</p>
                <ol className="mt-2 flex flex-col gap-1.5">
                  {detail.questions.map((question, index) => (
                    <li key={question.id} className="rounded-[8px] border border-line px-3 py-2">
                      <p className="text-[13.5px] leading-6 text-ink">
                        <span className="mr-2 font-mono text-[11.5px] text-subtle">{String(index + 1).padStart(2, "0")}</span>
                        {question.prompt}
                      </p>
                      <p className="mt-1 pl-7 text-[11px] uppercase tracking-[0.08em] text-subtle">
                        {labelOr(QUESTION_TYPE_LABELS, question.type)}, {question.required ? "required" : "optional"}
                      </p>
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}

            {detail.skills.length > 0 ? (
              <div className="mt-5 flex flex-wrap gap-1.5">
                {detail.skills.map((skill) => (
                  <Tag key={skill.id}>
                    {skill.name} ({skill.requirementLevel.replace("_", " ")})
                  </Tag>
                ))}
              </div>
            ) : null}
          </article>

          <div className="flex flex-wrap items-center gap-3 border-t border-line pt-6">
            <ButtonLink href={`/researcher/opportunities/${id}/edit?step=9`}>Continue to publish</ButtonLink>
            <Link
              href={`/researcher/opportunities/${id}/edit?step=1`}
              className="inline-flex h-10 items-center rounded-full border border-line-strong px-5 text-sm font-medium text-ink hover:bg-shell"
            >
              Go back and edit
            </Link>
          </div>
        </div>
      ) : null}

      {step === 9 ? <PublishStep id={id} alreadyPublished={detail.opportunity.status === "published"} /> : null}
    </OnboardingShell>
  );
}
