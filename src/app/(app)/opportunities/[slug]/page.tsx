import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import {
  BookOpen,
  Building2,
  CalendarClock,
  CircleDot,
  Clock,
  ExternalLink,
  FileText,
  MapPin,
  Target,
  Users,
} from "lucide-react";
import { db, opportunities } from "@/db";
import { Badge, Tag } from "@/components/ui/badge";
import { OpportunityActions } from "@/components/app/opportunity-actions";
import { currentUser } from "@/lib/auth/permissions";
import { evaluateDeterministic } from "@/lib/criteria/engine";
import type { Criterion } from "@/lib/criteria/types";
import { IMPORTANCE_LABEL } from "@/lib/criteria/weights";
import { deadlineNote, formatDate, hoursLabel, truncate } from "@/lib/format";
import {
  COMPENSATION_LABELS,
  CRITERION_TYPE_LABELS,
  DURATION_LABELS,
  LOCATION_LABELS,
  OPPORTUNITY_STATUS_LABELS,
  REVIEW_TASK_LABELS,
  PAID_COMPENSATION,
  QUESTION_TYPE_LABELS,
  RESEARCHER_TYPE_LABELS,
  REQUIREMENT_LABELS,
  labelOr,
} from "@/lib/labels";
import { countApplications, loadOpportunityBySlug, studentOpportunityState } from "@/lib/queries/opportunities";
import { loadStudentProfile, toApplicantEvidence } from "@/lib/queries/student";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const detail = await loadOpportunityBySlug(slug);
  if (!detail) return { title: "Opportunity not found" };
  return {
    title: detail.opportunity.title,
    description: truncate(detail.opportunity.summary, 155),
    alternates: { canonical: `/opportunities/${slug}` },
    robots: detail.opportunity.status === "published" ? { index: true, follow: true } : { index: false, follow: false },
  };
}

function Paragraphs({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <>
      {text
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line, index) => (
          <p key={index} className="mt-3 text-[15px] leading-7 text-muted first:mt-0">
            {line}
          </p>
        ))}
    </>
  );
}

function BulletList({ text }: { text: string | null }) {
  if (!text) return null;
  const items = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (items.length === 0) return null;
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item, index) => (
        <li key={index} className="flex gap-2.5 text-[15px] leading-7 text-muted">
          <CircleDot className="mt-2 size-3 shrink-0 text-forest" aria-hidden="true" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function Section({
  id,
  title,
  eyebrow,
  children,
}: {
  id?: string;
  title: string;
  eyebrow?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="border-t border-line py-7 first-of-type:border-t-0 first-of-type:pt-0">
      {eyebrow ? <p className="mb-2 text-[12px] font-medium text-subtle">{eyebrow}</p> : null}
      <h2 className="font-display text-[22px] text-ink" style={{ letterSpacing: "-0.4px" }}>
        {title}
      </h2>
      <div className="mt-3.5">{children}</div>
    </section>
  );
}

export default async function OpportunityDetailPage({ params }: Params) {
  const { slug } = await params;
  const detail = await loadOpportunityBySlug(slug);
  if (!detail) notFound();

  const user = await currentUser();
  const isStudent = user?.role === "student";
  const isOwner = user?.id === detail.opportunity.researcherId;

  if (detail.opportunity.status !== "published" && !isOwner && user?.role !== "admin") notFound();

  const [applicationCount, state] = await Promise.all([
    countApplications(detail.opportunity.id),
    isStudent ? studentOpportunityState(user.id, detail.opportunity.id) : Promise.resolve({ saved: false, application: null }),
  ]);

  if (detail.opportunity.status === "published" && !isOwner) {
    await db
      .update(opportunities)
      .set({ viewCount: sql`${opportunities.viewCount} + 1` })
      .where(eq(opportunities.id, detail.opportunity.id));
  }

  // A review posting has four fields by design, so it gets a page shaped like
  // the posting rather than a research listing with most sections empty.
  if (detail.opportunity.kind === "review_project") {
    return (
      <div className="mx-auto max-w-[860px] px-4 py-8 sm:px-6 sm:py-10">
        <nav aria-label="Breadcrumb" className="mb-5">
          <Link href="/reviews" className="text-[13px] text-muted underline decoration-line-strong underline-offset-4 hover:text-ink">
            Back to open reviews
          </Link>
        </nav>

        {detail.opportunity.status !== "published" ? (
          <div className="mb-6 rounded-[10px] border border-[#e6d7ae] bg-gold-soft px-4 py-3 text-[13.5px] text-warn">
            This review is {labelOr(OPPORTUNITY_STATUS_LABELS, detail.opportunity.status).toLowerCase()}. It is visible to
            you because you manage it.
          </div>
        ) : null}

        <div className="grid gap-8 lg:grid-cols-[1fr_300px] lg:gap-10">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge tone="outline">Review</Badge>
              <Badge tone={detail.opportunity.authorshipOffered ? "forest" : "neutral"}>
                {detail.opportunity.authorshipOffered ? "Authorship offered" : "No authorship"}
              </Badge>
            </div>

            <h1 className="mt-4 font-display text-[30px] leading-tight text-ink sm:text-[36px]" style={{ letterSpacing: "-0.7px" }}>
              {detail.opportunity.title}
            </h1>

            <p className="mt-3 text-[15px] leading-7 text-muted">
              Posted by {detail.researcher.title ? `${detail.researcher.title} ` : ""}
              {detail.researcher.firstName} {detail.researcher.lastName}
              {detail.opportunity.department ? `, ${detail.opportunity.department}` : ""}
            </p>

            <div className="mt-6 border-t border-line pt-6">
              <p className="text-[12px] font-medium text-subtle">About the review</p>
              <div className="mt-2">
                <Paragraphs text={detail.opportunity.summary} />
              </div>
            </div>

            <div className="mt-6 border-t border-line pt-6">
              <p className="text-[12px] font-medium text-subtle">What they need help with</p>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {detail.reviewTasks.length === 0 ? (
                  <p className="text-[14px] text-muted">Not specified.</p>
                ) : (
                  detail.reviewTasks.map((task) => (
                    <Badge key={task} tone="outline">
                      {labelOr(REVIEW_TASK_LABELS, task)}
                    </Badge>
                  ))
                )}
              </div>
            </div>

            <div className="mt-6 border-t border-line pt-6">
              <p className="text-[12px] font-medium text-subtle">Authorship</p>
              <p className="mt-1.5 text-[14.5px] leading-7 text-muted">
                {detail.opportunity.authorshipOffered
                  ? "The researcher has said contributors will be named as authors. Agree what that means in practice before you start."
                  : "The researcher has said there is no authorship on this one. That is stated up front so you can decide with the facts."}
              </p>
            </div>

            {isOwner ? (
              <div className="mt-6 border-t border-line pt-6">
                <Link
                  href={`/researcher/reviews/${detail.opportunity.id}/edit`}
                  className="text-[13.5px] text-forest underline decoration-line-strong underline-offset-4"
                >
                  Edit this review
                </Link>
              </div>
            ) : null}
          </div>

          <aside className="lg:sticky lg:top-[76px] lg:self-start">
            <div className="rounded-[12px] border border-line bg-white p-5">
              <OpportunityActions
                opportunityId={detail.opportunity.id}
                slug={detail.opportunity.slug}
                saved={state.saved}
                signedIn={Boolean(user)}
                isStudent={isStudent}
                applicationId={state.application?.id ?? null}
                applicationStatus={state.application?.status ?? null}
                acceptingApplications={detail.opportunity.status === "published"}
                closedReason="This review is no longer looking for help."
              />
              <p className="mt-4 border-t border-line pt-4 text-[12.5px] leading-5 text-muted">
                Applying to a review sends your profile and your resume. There are no extra questions, and{" "}
                {applicationCount === 0 ? "nobody has applied yet" : `${applicationCount} ${applicationCount === 1 ? "person has" : "people have"} applied`}
                .
              </p>
            </div>
          </aside>
        </div>
      </div>
    );
  }

  const criteria: Criterion[] = detail.criteria.map((criterion) => ({
    id: criterion.id,
    type: criterion.type,
    label: criterion.label,
    description: criterion.description,
    required: criterion.required,
    importance: criterion.importance,
    config: criterion.config,
    sortOrder: criterion.sortOrder,
  }));

  const required = criteria.filter((criterion) => criterion.required);
  const preferred = criteria.filter((criterion) => !criterion.required);

  let overlaps: { label: string; detail: string }[] = [];
  let gaps: { label: string; detail: string }[] = [];

  if (isStudent) {
    const bundle = await loadStudentProfile(user.id);
    if (bundle) {
      const evidence = toApplicantEvidence(bundle, []);
      const results = evaluateDeterministic(criteria, evidence);
      const byId = new Map(criteria.map((criterion) => [criterion.id, criterion]));
      for (const result of results) {
        const criterion = byId.get(result.criterionId);
        if (!criterion) continue;
        if (result.status === "met") {
          overlaps.push({ label: criterion.label, detail: result.evidence[0] ?? "Listed on your profile." });
        } else if (result.status === "partially_met" || result.status === "not_met") {
          gaps.push({
            label: criterion.label,
            detail: result.evidence[0] ?? "Nothing on your profile relates to this yet.",
          });
        }
      }
      overlaps = overlaps.slice(0, 6);
      gaps = gaps.slice(0, 5);
    }
  }

  const deadline = deadlineNote(detail.opportunity.deadline);
  const paid = PAID_COMPENSATION.has(detail.opportunity.compensationType);
  const pastDeadline = detail.opportunity.deadline
    ? new Date(`${detail.opportunity.deadline}T23:59:59Z`).getTime() < Date.now()
    : false;
  const accepting = detail.opportunity.status === "published" && !pastDeadline;

  const requiredSkills = detail.skills.filter((skill) => skill.requirementLevel === "required");
  const preferredSkills = detail.skills.filter((skill) => skill.requirementLevel === "preferred");
  const notRequiredSkills = detail.skills.filter((skill) => skill.requirementLevel === "not_required");

  const facts = [
    { Icon: Clock, label: "Time commitment", value: hoursLabel(detail.opportunity.hoursPerWeekMin, detail.opportunity.hoursPerWeekMax) },
    { Icon: CalendarClock, label: "Expected start", value: formatDate(detail.opportunity.startDate) },
    {
      Icon: Target,
      label: "Duration",
      value: detail.durations.map((value) => DURATION_LABELS[value]).join(", ") || detail.opportunity.duration || "Not specified",
    },
    {
      Icon: MapPin,
      label: "Location",
      value: `${labelOr(LOCATION_LABELS, detail.opportunity.locationMode)}${detail.opportunity.location && detail.opportunity.locationMode !== "remote" ? `, ${detail.opportunity.location}` : ""}`,
    },
    { Icon: Users, label: "Openings", value: String(detail.opportunity.numberOfOpenings) },
    { Icon: FileText, label: "Applications received", value: String(applicationCount) },
  ];

  return (
    <div className="mx-auto max-w-[1240px] px-4 py-8 sm:px-6 sm:py-10">
      <nav aria-label="Breadcrumb" className="mb-5">
        <Link href="/opportunities" className="text-[13px] text-muted underline decoration-line-strong underline-offset-4 hover:text-ink">
          Back to open positions
        </Link>
      </nav>

      {detail.opportunity.status !== "published" ? (
        <div className="mb-6 rounded-[10px] border border-[#e6d7ae] bg-gold-soft px-4 py-3 text-[13.5px] text-warn">
          This listing is {labelOr(OPPORTUNITY_STATUS_LABELS, detail.opportunity.status).toLowerCase()}. It is visible to
          you because you manage it.
        </div>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[1fr_340px] lg:gap-12">
        <div className="min-w-0">
          <header className="border-b border-line pb-7">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge tone={paid ? "forest" : "neutral"}>
                {labelOr(COMPENSATION_LABELS, detail.opportunity.compensationType)}
              </Badge>
              {detail.opportunity.beginnerFriendly ? <Badge tone="gold">Accepting beginners</Badge> : null}
              {detail.opportunity.academicCreditAvailable ? <Badge tone="outline">Academic credit available</Badge> : null}
              <Badge tone={deadline.urgent ? "warn" : "outline"}>{deadline.text}</Badge>
            </div>

            <h1 className="mt-4 font-display text-[30px] leading-tight text-ink sm:text-[38px]" style={{ letterSpacing: "-0.7px" }}>
              {detail.opportunity.title}
            </h1>

            <p className="mt-3 text-[15px] leading-7 text-muted">
              {detail.researcher.title ? `${detail.researcher.title} ` : ""}
              {detail.researcher.firstName} {detail.researcher.lastName}
              {detail.opportunity.department ? ` at ${detail.opportunity.department}` : ""}
              {detail.opportunity.labName ? `, ${detail.opportunity.labName}` : ""}
            </p>

            <div className="mt-4 flex flex-wrap gap-1.5">
              {detail.fields.map((field) => (
                <Tag key={field.id}>{field.name}</Tag>
              ))}
              {detail.durations.map((value) => (
                <Tag key={value}>{DURATION_LABELS[value]}</Tag>
              ))}
            </div>
          </header>

          <div className="pt-7">
            <Section title="Research overview" eyebrow="The project">
              <p className="text-[16px] font-medium leading-7 text-ink">{detail.opportunity.summary}</p>
              <div className="mt-4">
                <Paragraphs text={detail.opportunity.description} />
              </div>
              {detail.opportunity.projectGoals ? (
                <div className="mt-5 rounded-[10px] border border-line bg-shell/70 px-4 py-3.5">
                  <p className="text-[12px] font-medium text-subtle">Project goal</p>
                  <p className="mt-1.5 text-[14.5px] leading-7 text-muted">{detail.opportunity.projectGoals}</p>
                </div>
              ) : null}
            </Section>

            <Section title="What you would work on" eyebrow="The role">
              <BulletList text={detail.opportunity.responsibilities} />
              {detail.opportunity.techniques ? (
                <div className="mt-5">
                  <p className="text-[13px] font-medium text-ink">Techniques used</p>
                  <p className="mt-1 text-[14.5px] leading-7 text-muted">{detail.opportunity.techniques}</p>
                </div>
              ) : null}
              {detail.opportunity.expectedOutputs ? (
                <div className="mt-4">
                  <p className="text-[13px] font-medium text-ink">Expected outputs</p>
                  <p className="mt-1 text-[14.5px] leading-7 text-muted">{detail.opportunity.expectedOutputs}</p>
                </div>
              ) : null}
              {detail.opportunity.learningOpportunities ? (
                <div className="mt-4">
                  <p className="text-[13px] font-medium text-ink">What you would learn</p>
                  <p className="mt-1 text-[14.5px] leading-7 text-muted">{detail.opportunity.learningOpportunities}</p>
                </div>
              ) : null}
            </Section>

            <Section title="Who this researcher is looking for" eyebrow="Criteria">
              <p className="text-[14.5px] leading-7 text-muted">
                These are the criteria this researcher set for this project. Applications are reviewed against these and
                nothing else. Preferred criteria affect only their own share of the assessment.
              </p>

              {required.length > 0 ? (
                <div className="mt-5">
                  <p className="text-[12px] font-medium text-subtle">Required</p>
                  <ul className="mt-2.5 flex flex-col gap-2">
                    {required.map((criterion) => (
                      <li key={criterion.id} className="rounded-[10px] border border-line bg-white px-4 py-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-[14.5px] font-medium text-ink">{criterion.label}</p>
                          <Badge tone="forest">Required</Badge>
                        </div>
                        {criterion.description ? (
                          <p className="mt-1 text-[13.5px] leading-6 text-muted">{criterion.description}</p>
                        ) : null}
                        <p className="mt-1 text-[11.5px] text-subtle">
                          {labelOr(CRITERION_TYPE_LABELS, criterion.type)}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {preferred.length > 0 ? (
                <div className="mt-6">
                  <p className="text-[12px] font-medium text-subtle">Preferred</p>
                  <ul className="mt-2.5 flex flex-col gap-2">
                    {preferred.map((criterion) => (
                      <li key={criterion.id} className="rounded-[10px] border border-line bg-white px-4 py-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-[14.5px] font-medium text-ink">{criterion.label}</p>
                          <Badge tone="outline">{IMPORTANCE_LABEL[criterion.importance]}</Badge>
                        </div>
                        {criterion.description ? (
                          <p className="mt-1 text-[13.5px] leading-6 text-muted">{criterion.description}</p>
                        ) : null}
                        <p className="mt-1 text-[11.5px] text-subtle">
                          {labelOr(CRITERION_TYPE_LABELS, criterion.type)}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {requiredSkills.length > 0 ? (
                  <div>
                    <p className="text-[13px] font-medium text-ink">Required skills</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {requiredSkills.map((skill) => (
                        <Badge key={skill.id} tone="forest">
                          {skill.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : null}
                {preferredSkills.length > 0 ? (
                  <div>
                    <p className="text-[13px] font-medium text-ink">Preferred skills</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {preferredSkills.map((skill) => (
                        <Tag key={skill.id}>{skill.name}</Tag>
                      ))}
                    </div>
                  </div>
                ) : null}
                {notRequiredSkills.length > 0 ? (
                  <div>
                    <p className="text-[13px] font-medium text-ink">Explicitly not required</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {notRequiredSkills.map((skill) => (
                        <Tag key={skill.id}>{skill.name}</Tag>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              <p className="mt-5 rounded-[10px] border border-line bg-shell/70 px-4 py-3 text-[13.5px] leading-6 text-muted">
                Prior research experience is{" "}
                <span className="font-medium text-ink">
                  {detail.opportunity.priorResearchRequired ? "required" : "not required"}
                </span>{" "}
                for this position.
              </p>
            </Section>

            <Section title="Compensation" eyebrow="Terms">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={paid ? "forest" : "neutral"}>
                  {labelOr(COMPENSATION_LABELS, detail.opportunity.compensationType)}
                </Badge>
                {detail.opportunity.academicCreditAvailable ? <Badge tone="outline">Academic credit available</Badge> : null}
              </div>
              {detail.opportunity.compensationDetails ? (
                <p className="mt-3 text-[14.5px] leading-7 text-muted">{detail.opportunity.compensationDetails}</p>
              ) : null}
            </Section>

            {detail.materials.length > 0 ? (
              <Section title="Research material" eyebrow="Read before applying">
                <ul className="flex flex-col gap-3">
                  {detail.materials.map((material) => (
                    <li key={material.id} className="rounded-[10px] border border-line bg-white p-4">
                      <div className="flex items-start gap-2.5">
                        <BookOpen className="mt-1 size-4 shrink-0 text-forest" aria-hidden="true" />
                        <div className="min-w-0">
                          <p className="text-[15px] font-medium leading-6 text-ink">{material.title}</p>
                          {material.authors ? <p className="mt-0.5 text-[13px] text-muted">{material.authors}</p> : null}
                          {material.doi ? <p className="mt-0.5 font-mono text-[12px] text-subtle">DOI {material.doi}</p> : null}
                          {material.abstract ? (
                            <p className="mt-2 text-[14px] leading-6 text-muted">{material.abstract}</p>
                          ) : null}
                          {material.context ? (
                            <p className="mt-2 rounded-[8px] border border-line bg-shell/70 px-3 py-2 text-[13.5px] leading-6 text-muted">
                              From the researcher: {material.context}
                            </p>
                          ) : null}
                          {material.url ? (
                            <a
                              href={material.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-3 inline-flex items-center gap-1.5 text-[13.5px] font-medium text-forest underline decoration-line-strong underline-offset-4"
                            >
                              Open the paper
                              <ExternalLink className="size-3.5" aria-hidden="true" />
                            </a>
                          ) : null}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </Section>
            ) : null}

            <Section title="Application requirements" eyebrow="What you will be asked">
              {detail.questions.length === 0 ? (
                <p className="text-[14.5px] leading-7 text-muted">
                  This position asks only for your ResearchBridge profile. There are no additional questions.
                </p>
              ) : (
                <>
                  <p className="text-[14.5px] leading-7 text-muted">
                    Your ResearchBridge profile is included automatically. In addition, this researcher asks for:
                  </p>
                  <ol className="mt-3 flex flex-col gap-2">
                    {detail.questions.map((question, index) => (
                      <li key={question.id} className="rounded-[10px] border border-line bg-white px-4 py-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <p className="text-[14.5px] leading-6 text-ink">
                            <span className="mr-2 font-mono text-[12px] text-subtle">
                              {String(index + 1).padStart(2, "0")}
                            </span>
                            {question.prompt}
                          </p>
                          <Badge tone={question.required ? "forest" : "outline"}>
                            {question.required ? "Required" : "Optional"}
                          </Badge>
                        </div>
                        <p className="mt-1.5 pl-8 text-[11.5px] text-subtle">
                          {labelOr(QUESTION_TYPE_LABELS, question.type)}
                        </p>
                        {question.helpText ? (
                          <p className="mt-1 pl-8 text-[13px] leading-6 text-muted">{question.helpText}</p>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                </>
              )}
              {detail.opportunity.videoResponseEnabled ? (
                <p className="mt-4 rounded-[10px] border border-[#e6d7ae] bg-gold-soft px-4 py-3 text-[13.5px] leading-6 text-warn">
                  This researcher has enabled a short video response for this position, up to{" "}
                  {detail.opportunity.videoMaxSeconds ?? 60} seconds. You are told before the recording step begins, and
                  nothing about your appearance is analyzed.
                </p>
              ) : null}
            </Section>

            <Section title="About the researcher" eyebrow="Who you would work with">
              <div className="rounded-[10px] border border-line bg-white p-5">
                <p className="text-[16px] font-medium text-ink">
                  {detail.researcher.firstName} {detail.researcher.lastName}
                </p>
                <p className="mt-0.5 text-[13.5px] text-muted">
                  {detail.researcher.title ?? labelOr(RESEARCHER_TYPE_LABELS, detail.researcher.researcherType)}
                  {detail.researcher.department ? `, ${detail.researcher.department}` : ""}
                </p>
                {detail.researcher.biography ? (
                  <p className="mt-3 text-[14.5px] leading-7 text-muted">{detail.researcher.biography}</p>
                ) : null}
                {detail.researcherFields.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {detail.researcherFields.map((field) => (
                      <Tag key={field}>{field}</Tag>
                    ))}
                  </div>
                ) : null}
                <div className="mt-4 flex flex-wrap gap-4 text-[13.5px]">
                  {detail.researcher.labWebsite ? (
                    <a
                      href={detail.researcher.labWebsite}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-forest underline decoration-line-strong underline-offset-4"
                    >
                      Lab website
                      <ExternalLink className="size-3.5" aria-hidden="true" />
                    </a>
                  ) : null}
                  {detail.researcher.personalWebsite ? (
                    <a
                      href={detail.researcher.personalWebsite}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-forest underline decoration-line-strong underline-offset-4"
                    >
                      Research page
                      <ExternalLink className="size-3.5" aria-hidden="true" />
                    </a>
                  ) : null}
                </div>
              </div>
            </Section>
          </div>
        </div>

        <aside className="lg:sticky lg:top-[76px] lg:self-start">
          <div className="rounded-[12px] border border-line bg-white p-5">
            <OpportunityActions
              opportunityId={detail.opportunity.id}
              slug={detail.opportunity.slug}
              saved={state.saved}
              signedIn={Boolean(user)}
              isStudent={isStudent}
              applicationId={state.application?.id ?? null}
              applicationStatus={state.application?.status ?? null}
              acceptingApplications={accepting}
              closedReason={
                pastDeadline
                  ? "The application deadline for this position has passed."
                  : "This position is not accepting applications right now."
              }
            />

            <dl className="mt-6 divide-y divide-line border-t border-line">
              {facts.map((fact) => (
                <div key={fact.label} className="flex items-start justify-between gap-3 py-2.5">
                  <dt className="inline-flex items-center gap-2 text-[13px] text-muted">
                    <fact.Icon className="size-3.5 shrink-0 text-subtle" aria-hidden="true" />
                    {fact.label}
                  </dt>
                  <dd className="text-right text-[13px] font-medium text-ink">{fact.value}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-4 flex items-start gap-2 border-t border-line pt-4">
              <Building2 className="mt-0.5 size-3.5 shrink-0 text-subtle" aria-hidden="true" />
              <p className="text-[12.5px] leading-5 text-muted">
                Application deadline {formatDate(detail.opportunity.deadline)}. Posted{" "}
                {formatDate(detail.opportunity.publishedAt)}.
              </p>
            </div>
          </div>

          {isStudent && (overlaps.length > 0 || gaps.length > 0) ? (
            <div className="mt-4 rounded-[12px] border border-line bg-white p-5">
              <p className="text-[14px] font-medium text-ink">Your profile overlaps with several things this project is looking for</p>
              <p className="mt-1.5 text-[12.5px] leading-5 text-muted">
                Computed directly from your profile and the criteria on this listing. It is not a score, and a gap is not
                a reason to skip applying.
              </p>

              {overlaps.length > 0 ? (
                <div className="mt-4">
                  <p className="text-[11.5px] font-medium text-ok">Strong overlap</p>
                  <ul className="mt-2 flex flex-col gap-2">
                    {overlaps.map((item) => (
                      <li key={item.label} className="text-[13px] leading-5">
                        <span className="font-medium text-ink">{item.label}</span>
                        <span className="mt-0.5 block text-muted">{item.detail}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {gaps.length > 0 ? (
                <div className="mt-4 border-t border-line pt-4">
                  <p className="text-[11.5px] font-medium text-subtle">Possible gap</p>
                  <ul className="mt-2 flex flex-col gap-2">
                    {gaps.map((item) => (
                      <li key={item.label} className="text-[13px] leading-5">
                        <span className="font-medium text-ink">{item.label}</span>
                        <span className="mt-0.5 block text-muted">{item.detail}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-[12px] leading-5 text-subtle">
                    Researchers weigh preferred criteria themselves, and many hire students who do not meet all of them.
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
