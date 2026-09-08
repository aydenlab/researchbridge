import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db, opportunityResearchMaterials } from "@/db";
import { requireStudent } from "@/lib/auth/permissions";
import { formatDate } from "@/lib/format";
import { DEGREE_LABELS, LOCATION_LABELS, labelOr } from "@/lib/labels";
import { loadApplication } from "@/lib/queries/applications";
import { loadStudentProfile } from "@/lib/queries/student";
import { ApplicationForm } from "./application-form";
import { ResumeGate } from "./resume-gate";

export const metadata: Metadata = {
  title: "Your application",
  robots: { index: false, follow: false },
};

export default async function EditApplicationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireStudent();

  const bundle = await loadApplication(id);
  if (!bundle || bundle.application.studentId !== user.id) notFound();
  if (bundle.application.status !== "draft") redirect(`/applications/${id}`);

  const [profile, materials] = await Promise.all([
    loadStudentProfile(user.id),
    db
      .select()
      .from(opportunityResearchMaterials)
      .where(eq(opportunityResearchMaterials.opportunityId, bundle.opportunity.id))
      .orderBy(asc(opportunityResearchMaterials.sortOrder)),
  ]);

  if (!profile) redirect("/onboarding/student");

  const answers = Object.fromEntries(
    bundle.answers.map((answer) => [
      answer.questionId,
      {
        textAnswer: answer.textAnswer,
        fileId: answer.fileId,
        externalUrl: (answer.structuredAnswer as { externalUrl?: string } | null)?.externalUrl ?? null,
      },
    ]),
  );

  const profileSummary = [
    {
      label: "Name",
      value: [profile.profile.preferredName ?? profile.profile.firstName, profile.profile.lastName].filter(Boolean).join(" "),
    },
    {
      label: "Program",
      value: `${profile.profile.program ?? "Not set"}${profile.profile.yearLevel ? `, year ${profile.profile.yearLevel}` : ""} (${labelOr(DEGREE_LABELS, profile.profile.degreeLevel)})`,
    },
    { label: "Coursework", value: profile.courses.map((course) => course.courseCode).join(", ") || "None listed" },
    { label: "Skills", value: profile.skills.map((skill) => skill.name).join(", ") || "None listed" },
    { label: "Research interests", value: profile.fields.map((field) => field.name).join(", ") || "None listed" },
    {
      label: "Research experience",
      value:
        profile.experiences.length > 0
          ? profile.experiences.map((experience) => experience.organization).join(", ")
          : "None listed",
    },
    {
      label: "Availability",
      value:
        profile.profile.weeklyHours !== null
          ? `${profile.profile.weeklyHours} hours per week, ${labelOr(LOCATION_LABELS, profile.profile.locationPreference).toLowerCase()}, from ${formatDate(profile.profile.desiredStartDate)}`
          : "Not set",
    },
    { label: "Resume", value: profile.profile.resumeFileId ? "Attached to your profile" : "Not uploaded" },
  ];

  return (
    <div className="mx-auto max-w-[860px] px-4 py-8 sm:px-6 sm:py-10">
      <nav aria-label="Breadcrumb" className="mb-5">
        <Link
          href={`/opportunities/${bundle.opportunity.slug}`}
          className="text-[13px] text-muted underline decoration-line-strong underline-offset-4 hover:text-ink"
        >
          Back to the listing
        </Link>
      </nav>

      <header className="mb-7">
        <p className="text-[12px] font-medium text-subtle">Application draft</p>
        <h1 className="mt-2 font-display text-[28px] leading-tight text-ink sm:text-[32px]" style={{ letterSpacing: "-0.6px" }}>
          {bundle.opportunity.title}
        </h1>
        <p className="mt-2 text-[14.5px] text-muted">
          {bundle.researcher.title ? `${bundle.researcher.title} ` : ""}
          {bundle.researcher.firstName} {bundle.researcher.lastName}
          {bundle.opportunity.department ? `, ${bundle.opportunity.department}` : ""}
        </p>
        {bundle.opportunity.deadline ? (
          <p className="mt-1 text-[13px] text-muted">Applications close {formatDate(bundle.opportunity.deadline)}.</p>
        ) : null}
      </header>

      <div className="mb-6">
        <ResumeGate applicationId={bundle.application.id} hasResume={Boolean(profile.profile.resumeFileId)} />
      </div>

      <ApplicationForm
        applicationId={bundle.application.id}
        opportunityTitle={bundle.opportunity.title}
        opportunitySlug={bundle.opportunity.slug}
        researcherName={`${bundle.researcher.firstName} ${bundle.researcher.lastName}`}
        questions={bundle.questions.map((question) => ({
          id: question.id,
          type: question.type,
          prompt: question.prompt,
          helpText: question.helpText,
          required: question.required,
          config: question.config,
        }))}
        materials={materials.map((material) => ({
          id: material.id,
          title: material.title,
          authors: material.authors,
          url: material.url,
          doi: material.doi,
          abstract: material.abstract,
          context: material.context,
        }))}
        answers={answers}
        profileSummary={profileSummary}
        courseType={bundle.application.courseType}
        profileCourseTypes={profile.courseTypes}
        videoEnabled={bundle.opportunity.videoResponseEnabled}
        videoPrompt={bundle.opportunity.videoPrompt}
        videoMaxSeconds={bundle.opportunity.videoMaxSeconds ?? 60}
      />
    </div>
  );
}
