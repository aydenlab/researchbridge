import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db, researcherFields, researchFields, researcherProfiles } from "@/db";
import { OnboardingShell, type Step } from "@/components/app/onboarding-shell";
import { requireUser } from "@/lib/auth/permissions";
import { RESEARCHER_TYPE_LABELS, labelOr } from "@/lib/labels";
import { listDepartments, listFaculties, listResearchFields } from "@/lib/queries/taxonomy";
import { FacultyClaimForm } from "./claim-form";
import { ResearcherDetailsForm, ResearcherReviewForm } from "./forms";

export const metadata: Metadata = {
  title: "Set up your researcher account",
  robots: { index: false, follow: false },
};

const STEPS: Step[] = [
  { number: 1, label: "About you", description: "Your role, department, lab, and what your group works on." },
  { number: 2, label: "Review and submit", description: "Check the details, then send your account for review." },
  { number: 3, label: "Awaiting review", description: "A ResearchBridge administrator checks new researcher accounts." },
];

const RECRUITING_LABELS: Record<string, string> = {
  personally: "Myself",
  lab: "My lab or group",
  another_investigator: "Another investigator",
};

export default async function ResearcherOnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string }>;
}) {
  const user = await requireUser();
  if (user.role !== "researcher") redirect("/onboarding");

  const rows = await db.select().from(researcherProfiles).where(eq(researcherProfiles.userId, user.id)).limit(1);
  const profile = rows[0];
  if (!profile) redirect("/onboarding");

  // A profile that came off a faculty list gets one screen instead of the
  // wizard. Everything except what they need is already answered, and walking
  // somebody through three steps to confirm text we wrote for them is exactly
  // the friction pre-population exists to remove.
  if (profile.prefilledSource && !profile.claimedAt) {
    const institution = user.institutionId;
    const [claimFields, claimDepartments, claimSelected] = await Promise.all([
      listResearchFields(),
      institution ? listDepartments(institution) : Promise.resolve([]),
      db
        .select({ id: researchFields.id })
        .from(researcherFields)
        .innerJoin(researchFields, eq(researchFields.id, researcherFields.researchFieldId))
        .where(eq(researcherFields.researcherId, user.id)),
    ]);

    return (
      <div className="mx-auto max-w-[820px] px-4 py-8 sm:px-6 sm:py-10">
        <header className="mb-7">
          <p className="text-[12px] font-medium text-subtle">Researcher account</p>
          <h1 className="mt-1.5 font-display text-[28px] text-ink sm:text-[32px]" style={{ letterSpacing: "-0.6px" }}>
            Welcome, {profile.firstName || "and thank you for coming"}
          </h1>
          <p className="mt-2 max-w-2xl text-[15px] leading-7 text-muted">
            Your profile is already written. Check it, tell us what you are looking for, and you are finished.
          </p>
        </header>

        <FacultyClaimForm
          draft={{
            firstName: profile.firstName,
            lastName: profile.lastName,
            title: profile.title ?? "",
            department: profile.department ?? "",
            labName: profile.labName ?? "",
            labWebsite: profile.labWebsite ?? "",
            biography: profile.biography ?? "",
            recruitingNeeds: profile.recruitingNeeds ?? "",
            recruitingOnBehalfOf: profile.recruitingOnBehalfOf ?? "personally",
          }}
          fields={claimFields.map((field) => ({ id: field.id, name: field.name }))}
          selectedFieldIds={claimSelected.map((field) => field.id)}
          departments={claimDepartments.map((department) => department.name)}
          source={profile.prefilledSource}
        />
      </div>
    );
  }

  const params = await searchParams;
  const furthest = Math.max(1, Math.min(profile.onboardingStep, 2));
  const requested = Number(params.step ?? furthest);
  const step = Number.isFinite(requested) ? Math.min(Math.max(Math.round(requested), 1), 2) : furthest;

  const institutionId = user.institutionId;
  const [fields, faculties, departments, selected] = await Promise.all([
    listResearchFields(),
    institutionId ? listFaculties(institutionId) : Promise.resolve([]),
    institutionId ? listDepartments(institutionId) : Promise.resolve([]),
    db
      .select({ id: researchFields.id, name: researchFields.name })
      .from(researcherFields)
      .innerJoin(researchFields, eq(researchFields.id, researcherFields.researchFieldId))
      .where(eq(researcherFields.researcherId, user.id)),
  ]);

  const summary = [
    { label: "Name", value: [profile.firstName, profile.lastName].filter(Boolean).join(" ") || "Not set" },
    { label: "Role", value: labelOr(RESEARCHER_TYPE_LABELS, profile.researcherType) },
    { label: "Title", value: profile.title ?? "Not set" },
    { label: "Department", value: profile.department ?? "Not set" },
    { label: "Faculty", value: profile.faculty ?? "Not set" },
    { label: "Lab or group", value: profile.labName ?? "Not set" },
    { label: "Lab website", value: profile.labWebsite ?? "Not set" },
    { label: "Research areas", value: selected.length > 0 ? selected.map((field) => field.name).join(", ") : "None selected" },
    { label: "Recruiting for", value: labelOr(RECRUITING_LABELS, profile.recruitingOnBehalfOf) },
    { label: "Biography", value: profile.biography ?? "Not set" },
  ];

  return (
    <OnboardingShell
      title="Researcher account"
      intro="Students see this alongside every position you post."
      steps={STEPS}
      current={step}
      basePath="/onboarding/researcher"
      furthest={furthest}
    >
      {step === 1 ? (
        <ResearcherDetailsForm
          draft={{
            firstName: profile.firstName,
            lastName: profile.lastName,
            researcherType: profile.researcherType,
            title: profile.title,
            faculty: profile.faculty,
            department: profile.department,
            labName: profile.labName,
            labWebsite: profile.labWebsite,
            personalWebsite: profile.personalWebsite,
            linkedinUrl: profile.linkedinUrl,
            orcidId: profile.orcidId,
            contactEmail: profile.contactEmail,
            biography: profile.biography,
            recruitingOnBehalfOf: profile.recruitingOnBehalfOf,
          }}
          fields={fields.map((field) => ({ id: field.id, name: field.name }))}
          selectedFieldIds={selected.map((field) => field.id)}
          faculties={faculties.map((faculty) => faculty.name)}
          departments={departments.map((department) => department.name)}
        />
      ) : (
        <ResearcherReviewForm summary={summary} verificationStatus={profile.verificationStatus} />
      )}
    </OnboardingShell>
  );
}
