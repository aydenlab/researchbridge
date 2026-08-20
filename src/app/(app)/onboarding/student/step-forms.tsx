"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { CheckboxGrid, ExperienceRows, SkillRows, TokenField, type ExperienceRow, type SkillRow } from "@/components/app/inputs";
import { StepActions } from "@/components/app/onboarding-shell";
import { Field, FormError, FormNote, Input, RadioRow, Select, Textarea } from "@/components/ui/field";
import type { ActionResult } from "@/lib/errors";
import { GRADE_SCALES } from "@/lib/gpa";
import { RESEARCH_OUTPUT_OPTIONS, SEMESTER_OPTIONS } from "@/lib/labels";
import {
  completeStudentOnboardingAction,
  saveAcademicsAction,
  saveAvailabilityAction,
  saveBasicsAction,
  saveExperiencesAction,
  saveInterestsAction,
  saveResumeAction,
  saveSkillsAction,
} from "./actions";

function Actions({ backHref, submitLabel }: { backHref?: string; submitLabel?: string }) {
  const { pending } = useFormStatus();
  return <StepActions backHref={backHref} submitLabel={submitLabel} pending={pending} />;
}

type Profile = {
  firstName: string;
  lastName: string;
  preferredName: string | null;
  degreeLevel: string | null;
  program: string | null;
  faculty: string | null;
  specialization: string | null;
  yearLevel: number | null;
  graduationYear: number | null;
  researchInterestSummary: string | null;
  desiredStartDate: string | null;
  weeklyHours: number | null;
  semesters: string[] | null;
  summerAvailable: boolean | null;
  locationPreference: string | null;
  scheduleNotes: string | null;
  distinctions: string | null;
  resumeFileId: string | null;
};

const DEGREE_OPTIONS = [
  { value: "undergraduate", label: "Undergraduate" },
  { value: "masters", label: "Master's" },
  { value: "phd", label: "PhD" },
  { value: "professional", label: "Professional" },
  { value: "postdoctoral", label: "Postdoctoral" },
  { value: "other", label: "Other" },
];

export function BasicsForm({ profile, faculties }: { profile: Profile; faculties: string[] }) {
  const [state, action] = useActionState<ActionResult | null, FormData>(saveBasicsAction, null);
  const errors = state?.ok === false ? state.fieldErrors : undefined;

  return (
    <form action={action} className="flex flex-col gap-5">
      <FormError>{state?.ok === false ? state.error : null}</FormError>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="First name" htmlFor="firstName" required error={errors?.firstName?.[0]}>
          <Input id="firstName" name="firstName" defaultValue={profile.firstName} required autoComplete="given-name" />
        </Field>
        <Field label="Last name" htmlFor="lastName" required error={errors?.lastName?.[0]}>
          <Input id="lastName" name="lastName" defaultValue={profile.lastName} required autoComplete="family-name" />
        </Field>
      </div>

      <Field label="Preferred name" htmlFor="preferredName" hint="Used instead of your first name across ResearchBridge.">
        <Input id="preferredName" name="preferredName" defaultValue={profile.preferredName ?? ""} />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Degree level" htmlFor="degreeLevel" required error={errors?.degreeLevel?.[0]}>
          <Select id="degreeLevel" name="degreeLevel" defaultValue={profile.degreeLevel ?? ""} required>
            <option value="">Choose a degree level</option>
            {DEGREE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Program" htmlFor="program" required error={errors?.program?.[0]}>
          <Input id="program" name="program" defaultValue={profile.program ?? ""} placeholder="Bachelor of Health Sciences" required />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Faculty" htmlFor="faculty">
          <Select id="faculty" name="faculty" defaultValue={profile.faculty ?? ""}>
            <option value="">Not listed</option>
            {faculties.map((faculty) => (
              <option key={faculty} value={faculty}>
                {faculty}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Specialization or stream" htmlFor="specialization">
          <Input id="specialization" name="specialization" defaultValue={profile.specialization ?? ""} />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Current year of study" htmlFor="yearLevel" required error={errors?.yearLevel?.[0]}>
          <Input
            id="yearLevel"
            name="yearLevel"
            type="number"
            min={1}
            max={12}
            defaultValue={profile.yearLevel ?? ""}
            required
          />
        </Field>
        <Field label="Expected graduation year" htmlFor="graduationYear" required error={errors?.graduationYear?.[0]}>
          <Input
            id="graduationYear"
            name="graduationYear"
            type="number"
            min={2020}
            max={2040}
            defaultValue={profile.graduationYear ?? ""}
            required
          />
        </Field>
      </div>

      <Actions />
    </form>
  );
}

export function AcademicsForm({
  profile,
  courseSuggestions,
  selectedCourses,
  metric,
  institutionScaleName,
}: {
  profile: Profile;
  courseSuggestions: string[];
  selectedCourses: string[];
  metric: { scaleId: string | null; value: string | null; label: string | null } | null;
  institutionScaleName: string | null;
}) {
  const [state, action] = useActionState<ActionResult | null, FormData>(saveAcademicsAction, null);
  const [scaleId, setScaleId] = useState(metric?.scaleId ?? "");
  const errors = state?.ok === false ? state.fieldErrors : undefined;
  const scale = GRADE_SCALES.find((item) => item.id === scaleId);

  return (
    <form action={action} className="flex flex-col gap-5">
      <FormError>{state?.ok === false ? state.error : null}</FormError>

      <FormNote>
        Academic standing is optional. Researchers decide whether it matters for their own project, and many do not ask
        for it at all. ResearchBridge stores the value and the scale exactly as you enter them.
        {institutionScaleName ? ` Your institution uses the ${institutionScaleName} scale by default.` : ""}
      </FormNote>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Grading scale" htmlFor="scaleId">
          <Select id="scaleId" name="scaleId" value={scaleId} onChange={(event) => setScaleId(event.target.value)}>
            <option value="">Prefer not to share</option>
            {GRADE_SCALES.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label={scale ? `Value out of ${scale.max}` : "Value"}
          htmlFor="metricValue"
          error={errors?.metricValue?.[0]}
          hint={scale ? `Enter a number between 0 and ${scale.max}.` : "Choose a scale first."}
        >
          <Input
            id="metricValue"
            name="metricValue"
            type="number"
            step="0.01"
            min={0}
            max={scale?.max}
            disabled={!scale}
            defaultValue={metric?.value ?? ""}
          />
        </Field>
      </div>

      <Field label="What this average covers" htmlFor="metricLabel">
        <Input id="metricLabel" name="metricLabel" defaultValue={metric?.label ?? ""} placeholder="Cumulative average" />
      </Field>

      <TokenField
        name="courseCodes"
        label="Relevant coursework"
        hint="Add the course codes that relate to research you want to do. Researchers often ask for a specific course."
        placeholder="BIOLOGY 2B03"
        suggestions={courseSuggestions}
        initial={selectedCourses}
        max={60}
      />

      <Field label="Academic distinctions" htmlFor="distinctions" hint="Awards, scholarships, or dean's list entries.">
        <Textarea id="distinctions" name="distinctions" defaultValue={profile.distinctions ?? ""} rows={3} />
      </Field>

      <Actions backHref="/onboarding/student?step=1" />
    </form>
  );
}

export function SkillsForm({ initial, suggestions }: { initial: SkillRow[]; suggestions: string[] }) {
  const [state, action] = useActionState<ActionResult | null, FormData>(saveSkillsAction, null);

  return (
    <form action={action} className="flex flex-col gap-5">
      <FormError>{state?.ok === false ? state.error : null}</FormError>
      <FormNote>
        Add what you can actually do, at whatever level you are at. Some exposure is a real answer, and a researcher who
        needs a beginner would rather see it stated honestly.
      </FormNote>
      <SkillRows initial={initial} suggestions={suggestions} />
      <Actions backHref="/onboarding/student?step=2" />
    </form>
  );
}

export function InterestsForm({
  fields,
  selectedFieldIds,
  summary,
}: {
  fields: { id: string; name: string }[];
  selectedFieldIds: string[];
  summary: string | null;
}) {
  const [state, action] = useActionState<ActionResult | null, FormData>(saveInterestsAction, null);
  const errors = state?.ok === false ? state.fieldErrors : undefined;

  return (
    <form action={action} className="flex flex-col gap-5">
      <FormError>{state?.ok === false ? state.error : null}</FormError>

      <fieldset>
        <legend className="mb-2 text-[13px] font-medium text-ink">Research areas</legend>
        <CheckboxGrid
          name="researchFieldIds"
          options={fields.map((field) => ({ value: field.id, label: field.name }))}
          initial={selectedFieldIds}
        />
      </fieldset>

      <TokenField
        name="customInterests"
        label="Anything not on the list"
        hint="Add your own area if it is missing. It becomes available to everyone."
        placeholder="Sleep and circadian biology"
        max={12}
      />

      <Field
        label="What problems or topics genuinely interest you?"
        htmlFor="researchInterestSummary"
        hint="A few sentences. This is often the first thing a researcher reads, and specifics land better than enthusiasm."
        error={errors?.researchInterestSummary?.[0]}
      >
        <Textarea
          id="researchInterestSummary"
          name="researchInterestSummary"
          rows={6}
          defaultValue={summary ?? ""}
          maxLength={1500}
        />
      </Field>

      <Actions backHref="/onboarding/student?step=3" />
    </form>
  );
}

export function ExperienceForm({ initial }: { initial: ExperienceRow[] }) {
  const [state, action] = useActionState<ActionResult | null, FormData>(saveExperiencesAction, null);

  return (
    <form action={action} className="flex flex-col gap-5">
      <FormError>{state?.ok === false ? state.error : null}</FormError>
      <FormNote>
        Previous research experience is optional. Leaving this empty does not disadvantage you on ResearchBridge, and
        many listings state plainly that prior research is not required. Possible outputs include{" "}
        {RESEARCH_OUTPUT_OPTIONS.join(", ").toLowerCase()}.
      </FormNote>
      <ExperienceRows initial={initial} />
      <Actions backHref="/onboarding/student?step=4" />
    </form>
  );
}

export function AvailabilityForm({ profile }: { profile: Profile }) {
  const [state, action] = useActionState<ActionResult | null, FormData>(saveAvailabilityAction, null);
  const errors = state?.ok === false ? state.fieldErrors : undefined;

  return (
    <form action={action} className="flex flex-col gap-5">
      <FormError>{state?.ok === false ? state.error : null}</FormError>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Desired start date" htmlFor="desiredStartDate">
          <Input id="desiredStartDate" name="desiredStartDate" type="date" defaultValue={profile.desiredStartDate ?? ""} />
        </Field>
        <Field
          label="Hours per week you can commit"
          htmlFor="weeklyHours"
          required
          error={errors?.weeklyHours?.[0]}
          hint="Be realistic. Several positions have a minimum, and this is checked directly."
        >
          <Input
            id="weeklyHours"
            name="weeklyHours"
            type="number"
            min={0}
            max={60}
            defaultValue={profile.weeklyHours ?? ""}
            required
          />
        </Field>
      </div>

      <fieldset>
        <legend className="mb-2 text-[13px] font-medium text-ink">Semesters you are available</legend>
        <CheckboxGrid
          name="semesters"
          columns={4}
          options={SEMESTER_OPTIONS.map((semester) => ({ value: semester, label: semester }))}
          initial={profile.semesters ?? []}
        />
      </fieldset>

      <label className="flex cursor-pointer items-start gap-2.5 rounded-[8px] border border-line bg-white px-3 py-2.5">
        <input
          type="checkbox"
          name="summerAvailable"
          value="true"
          defaultChecked={profile.summerAvailable ?? false}
          className="mt-0.5 size-4 accent-[#1d4436]"
        />
        <span className="text-[13.5px] text-ink">I am available for full-time summer research</span>
      </label>

      <fieldset>
        <legend className="mb-2 text-[13px] font-medium text-ink">Location preference</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          <RadioRow
            id="loc-in_person"
            name="locationPreference"
            value="in_person"
            label="In person"
            defaultChecked={profile.locationPreference === "in_person"}
          />
          <RadioRow
            id="loc-hybrid"
            name="locationPreference"
            value="hybrid"
            label="Hybrid"
            defaultChecked={profile.locationPreference === "hybrid"}
          />
          <RadioRow
            id="loc-remote"
            name="locationPreference"
            value="remote"
            label="Remote"
            defaultChecked={profile.locationPreference === "remote"}
          />
        </div>
      </fieldset>

      <Field label="Schedule notes" htmlFor="scheduleNotes" hint="Fixed classes, shift work, or anything a researcher should know.">
        <Textarea id="scheduleNotes" name="scheduleNotes" rows={3} defaultValue={profile.scheduleNotes ?? ""} />
      </Field>

      <Actions backHref="/onboarding/student?step=5" />
    </form>
  );
}

export function ResumeForm({ hasResume }: { hasResume: boolean }) {
  const [state, action] = useActionState<ActionResult | null, FormData>(saveResumeAction, null);

  return (
    <form action={action} className="flex flex-col gap-5">
      <FormError>{state?.ok === false ? state.error : null}</FormError>

      <FormNote>
        A resume is optional. You can apply to any position that does not require one, and the listing states whether it
        is required before you start an application.
      </FormNote>

      <Field label="Resume" htmlFor="resume" hint="PDF only, up to 8 MB.">
        <Input id="resume" name="resume" type="file" accept="application/pdf" className="py-1.5" />
      </Field>

      {hasResume ? (
        <label className="flex cursor-pointer items-start gap-2.5 rounded-[8px] border border-line bg-white px-3 py-2.5">
          <input type="checkbox" name="removeResume" className="mt-0.5 size-4 accent-[#1d4436]" />
          <span className="text-[13.5px] text-ink">Remove the resume currently on my profile</span>
        </label>
      ) : null}

      <Actions backHref="/onboarding/student?step=6" />
    </form>
  );
}

export function ReviewForm({
  completion,
  missing,
  summary,
}: {
  completion: number;
  missing: string[];
  summary: { label: string; value: string }[];
}) {
  const [state, action] = useActionState<ActionResult | null, FormData>(completeStudentOnboardingAction, null);

  return (
    <form action={action} className="flex flex-col gap-6">
      <FormError>{state?.ok === false ? state.error : null}</FormError>

      <div className="rounded-[10px] border border-line bg-shell/60 p-4">
        <div className="flex items-center justify-between gap-4">
          <p className="text-[14px] font-medium text-ink">Profile completeness</p>
          <p className="font-mono text-[14px] text-forest">{completion} percent</p>
        </div>
        <div
          role="progressbar"
          aria-valuenow={completion}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Profile completeness"
          className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-line"
        >
          <div className="h-full rounded-full bg-forest" style={{ width: `${completion}%` }} />
        </div>
        <p className="mt-3 text-[13px] leading-6 text-muted">
          Your profile gives researchers context when they review your applications.
        </p>
        {missing.length > 0 ? (
          <p className="mt-2 text-[13px] leading-6 text-muted">Not filled in yet: {missing.join(", ")}.</p>
        ) : null}
      </div>

      <dl className="divide-y divide-line border-y border-line">
        {summary.map((item) => (
          <div key={item.label} className="grid gap-1 py-3 sm:grid-cols-[200px_1fr] sm:gap-4">
            <dt className="text-[13px] text-subtle">{item.label}</dt>
            <dd className="text-[14px] text-ink">{item.value}</dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-wrap items-center gap-3">
        <Actions backHref="/onboarding/student?step=7" submitLabel="Finish and explore opportunities" />
      </div>

      <p className="text-[12.5px] text-subtle">
        You can change any of this later from{" "}
        <Link href="/profile" className="underline decoration-line-strong underline-offset-4">
          your profile
        </Link>
        .
      </p>
    </form>
  );
}
