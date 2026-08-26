import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OnboardingShell, type Step } from "@/components/app/onboarding-shell";
import { requireUser } from "@/lib/auth/permissions";
import { formatDate } from "@/lib/format";
import { GRADE_SCALES, scaleForMetric } from "@/lib/gpa";
import { DEGREE_LABELS, LOCATION_LABELS, labelOr } from "@/lib/labels";
import { computeProfileCompletion, loadStudentProfile, missingProfileItems, toAcademicMetrics } from "@/lib/queries/student";
import { listCourses, listFaculties, listResearchFields, listSkills, loadInstitution } from "@/lib/queries/taxonomy";
import {
  AcademicsForm,
  AvailabilityForm,
  BasicsForm,
  ExperienceForm,
  InterestsForm,
  ResumeForm,
  ReviewForm,
  SkillsForm,
} from "./step-forms";

export const metadata: Metadata = {
  title: "Build your student profile",
  robots: { index: false, follow: false },
};

const STEPS: Step[] = [
  { number: 1, label: "Basics", description: "Your name, program, and where you are in your degree." },
  { number: 2, label: "Academics", description: "Coursework you have completed, and academic standing if you want to share it." },
  { number: 3, label: "Skills", description: "What you can do, at the level you can currently do it." },
  { number: 4, label: "Research interests", description: "The areas and the questions that actually interest you." },
  { number: 5, label: "Experience", description: "Any previous research. This step is optional." },
  { number: 6, label: "Availability", description: "When you can start, and how many hours you can commit." },
  { number: 7, label: "Resume", description: "Optional. Some positions ask for one, many do not." },
  { number: 8, label: "Review", description: "Check what researchers will see alongside your applications." },
];

export default async function StudentOnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string }>;
}) {
  const user = await requireUser();
  if (user.role !== "student") redirect("/onboarding");

  const bundle = await loadStudentProfile(user.id);
  if (!bundle) redirect("/onboarding");

  const params = await searchParams;
  const furthest = Math.max(1, Math.min(bundle.profile.onboardingStep, STEPS.length));
  const requested = Number(params.step ?? furthest);
  const step = Number.isFinite(requested) ? Math.min(Math.max(Math.round(requested), 1), STEPS.length) : furthest;

  const institutionId = user.institutionId;
  const [fields, allSkills, courses, faculties, institution] = await Promise.all([
    listResearchFields(),
    listSkills(),
    institutionId ? listCourses(institutionId) : Promise.resolve([]),
    institutionId ? listFaculties(institutionId) : Promise.resolve([]),
    institutionId ? loadInstitution(institutionId) : Promise.resolve(null),
  ]);

  const profile = {
    firstName: bundle.profile.firstName,
    lastName: bundle.profile.lastName,
    preferredName: bundle.profile.preferredName,
    degreeLevel: bundle.profile.degreeLevel,
    program: bundle.profile.program,
    faculty: bundle.profile.faculty,
    specialization: bundle.profile.specialization,
    yearLevel: bundle.profile.yearLevel,
    graduationYear: bundle.profile.graduationYear,
    researchInterestSummary: bundle.profile.researchInterestSummary,
    desiredStartDate: bundle.profile.desiredStartDate,
    weeklyHours: bundle.profile.weeklyHours,
    semesters: bundle.profile.semesters,
    summerAvailable: bundle.profile.summerAvailable,
    locationPreference: bundle.profile.locationPreference,
    scheduleNotes: bundle.profile.scheduleNotes,
    distinctions: bundle.profile.distinctions,
    resumeFileId: bundle.profile.resumeFileId,
    linkedinUrl: bundle.profile.linkedinUrl,
    orcidId: bundle.profile.orcidId,
  };

  const metrics = toAcademicMetrics(bundle.academicRecords);
  const firstMetric = metrics[0];
  const metricScale = firstMetric ? scaleForMetric(firstMetric) : null;
  const metric = firstMetric
    ? {
        scaleId: metricScale?.id ?? GRADE_SCALES[0].id,
        value: String(firstMetric.value),
        label: bundle.academicRecords[0]?.label ?? null,
      }
    : null;

  const completion = computeProfileCompletion(bundle);
  const missing = missingProfileItems(bundle);

  const summary = [
    { label: "Name", value: [profile.preferredName ?? profile.firstName, profile.lastName].filter(Boolean).join(" ") || "Not set" },
    { label: "Program", value: profile.program ?? "Not set" },
    { label: "Degree level", value: labelOr(DEGREE_LABELS, profile.degreeLevel) },
    { label: "Year of study", value: profile.yearLevel ? `Year ${profile.yearLevel}` : "Not set" },
    { label: "Coursework listed", value: bundle.courses.length > 0 ? bundle.courses.map((course) => course.courseCode).join(", ") : "None yet" },
    { label: "Skills listed", value: bundle.skills.length > 0 ? bundle.skills.map((skill) => skill.name).join(", ") : "None yet" },
    { label: "Research interests", value: bundle.fields.length > 0 ? bundle.fields.map((field) => field.name).join(", ") : "None yet" },
    { label: "Research experience", value: bundle.experiences.length > 0 ? `${bundle.experiences.length} listed` : "None listed" },
    {
      label: "Availability",
      value:
        profile.weeklyHours !== null
          ? `${profile.weeklyHours} hours per week, ${labelOr(LOCATION_LABELS, profile.locationPreference).toLowerCase()}`
          : "Not set",
    },
    { label: "Desired start", value: profile.desiredStartDate ? formatDate(profile.desiredStartDate) : "Not set" },
    { label: "Resume", value: profile.resumeFileId ? "Uploaded" : "Not uploaded" },
  ];

  return (
    <OnboardingShell
      title="Student profile"
      intro="You fill this in once. It travels with every application you send."
      steps={STEPS}
      current={step}
      basePath="/onboarding/student"
      furthest={furthest}
    >
      {step === 1 ? <BasicsForm profile={profile} faculties={faculties.map((faculty) => faculty.name)} /> : null}
      {step === 2 ? (
        <AcademicsForm
          profile={profile}
          courseSuggestions={courses.map((course) => course.courseCode)}
          selectedCourses={bundle.courses.map((course) => course.courseCode)}
          metric={metric}
          institutionScaleName={institution?.gpaScaleName ?? null}
        />
      ) : null}
      {step === 3 ? (
        <SkillsForm
          initial={bundle.skills.map((skill) => ({ name: skill.name, proficiency: skill.proficiency, context: skill.context }))}
          suggestions={allSkills.map((skill) => skill.name)}
        />
      ) : null}
      {step === 4 ? (
        <InterestsForm
          fields={fields.map((field) => ({ id: field.id, name: field.name }))}
          selectedFieldIds={bundle.fields.map((field) => field.id)}
          summary={profile.researchInterestSummary}
        />
      ) : null}
      {step === 5 ? (
        <ExperienceForm
          initial={bundle.experiences.map((experience) => ({
            organization: experience.organization,
            supervisor: experience.supervisor,
            title: experience.title,
            startDate: experience.startDate,
            endDate: experience.endDate,
            description: experience.description,
            techniques: experience.techniques ?? [],
            outputs: experience.outputs ?? [],
          }))}
        />
      ) : null}
      {step === 6 ? <AvailabilityForm profile={profile} /> : null}
      {step === 7 ? (
        <ResumeForm
          hasResume={Boolean(profile.resumeFileId)}
          hasWritingSample={Boolean(bundle.profile.writingSampleFileId)}
          hasVideoIntro={Boolean(bundle.profile.videoIntroFileId)}
        />
      ) : null}
      {step === 8 ? <ReviewForm completion={completion} missing={missing} summary={summary} /> : null}
    </OnboardingShell>
  );
}
