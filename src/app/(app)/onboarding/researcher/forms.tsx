"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { CheckboxGrid } from "@/components/app/inputs";
import { StepActions } from "@/components/app/onboarding-shell";
import { Field, FormError, FormNote, Input, RadioRow, Select, Textarea } from "@/components/ui/field";
import type { ActionResult } from "@/lib/errors";
import { RESEARCHER_TYPE_LABELS } from "@/lib/labels";
import { saveResearcherDetailsAction, submitResearcherForReviewAction } from "./actions";

function Actions({ backHref, submitLabel }: { backHref?: string; submitLabel?: string }) {
  const { pending } = useFormStatus();
  return <StepActions backHref={backHref} submitLabel={submitLabel} pending={pending} />;
}

export type ResearcherDraft = {
  firstName: string;
  lastName: string;
  researcherType: string | null;
  title: string | null;
  faculty: string | null;
  department: string | null;
  labName: string | null;
  labWebsite: string | null;
  personalWebsite: string | null;
  linkedinUrl: string | null;
  orcidId: string | null;
  contactEmail: string | null;
  biography: string | null;
  recruitingOnBehalfOf: string | null;
};

export function ResearcherDetailsForm({
  draft,
  fields,
  selectedFieldIds,
  faculties,
  departments,
}: {
  draft: ResearcherDraft;
  fields: { id: string; name: string }[];
  selectedFieldIds: string[];
  faculties: string[];
  departments: string[];
}) {
  const [state, action] = useActionState<ActionResult | null, FormData>(saveResearcherDetailsAction, null);
  const errors = state?.ok === false ? state.fieldErrors : undefined;

  return (
    <form action={action} className="flex flex-col gap-5">
      <FormError>{state?.ok === false ? state.error : null}</FormError>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="First name" htmlFor="firstName" required error={errors?.firstName?.[0]}>
          <Input id="firstName" name="firstName" defaultValue={draft.firstName} required />
        </Field>
        <Field label="Last name" htmlFor="lastName" required error={errors?.lastName?.[0]}>
          <Input id="lastName" name="lastName" defaultValue={draft.lastName} required />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Your role" htmlFor="researcherType" required error={errors?.researcherType?.[0]}>
          <Select id="researcherType" name="researcherType" defaultValue={draft.researcherType ?? ""} required>
            <option value="">Choose a role</option>
            {Object.entries(RESEARCHER_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Title" htmlFor="title" hint="As it appears in your department listing.">
          <Input id="title" name="title" defaultValue={draft.title ?? ""} placeholder="Associate Professor" />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Faculty" htmlFor="faculty">
          <Select id="faculty" name="faculty" defaultValue={draft.faculty ?? ""}>
            <option value="">Not listed</option>
            {faculties.map((faculty) => (
              <option key={faculty} value={faculty}>
                {faculty}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Department" htmlFor="department" required error={errors?.department?.[0]}>
          <Input id="department" name="department" list="departments" defaultValue={draft.department ?? ""} required />
        </Field>
      </div>
      <datalist id="departments">
        {departments.map((department) => (
          <option key={department} value={department} />
        ))}
      </datalist>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Lab or research group" htmlFor="labName">
          <Input id="labName" name="labName" defaultValue={draft.labName ?? ""} />
        </Field>
        <Field label="Lab website" htmlFor="labWebsite" error={errors?.labWebsite?.[0]}>
          <Input id="labWebsite" name="labWebsite" type="url" defaultValue={draft.labWebsite ?? ""} placeholder="https://" />
        </Field>
      </div>

      <Field label="Personal research page" htmlFor="personalWebsite" error={errors?.personalWebsite?.[0]}>
        <Input id="personalWebsite" name="personalWebsite" type="url" defaultValue={draft.personalWebsite ?? ""} placeholder="https://" />
      </Field>

      <Field
        label="LinkedIn"
        htmlFor="linkedinUrl"
        hint="Optional."
        error={errors?.linkedinUrl?.[0]}
      >
        <Input id="linkedinUrl" name="linkedinUrl" type="url" defaultValue={draft.linkedinUrl ?? ""} placeholder="https://www.linkedin.com/in/" />
      </Field>

      <Field
        label="ORCID iD"
        htmlFor="orcidId"
        hint="Optional. Students use it to find your published work."
        error={errors?.orcidId?.[0]}
      >
        <Input id="orcidId" name="orcidId" type="text" defaultValue={draft.orcidId ?? ""} placeholder="0000-0002-1825-0097" />
      </Field>

      <Field
        label="Contact email"
        htmlFor="contactEmail"
        hint="Optional. Shown to students you contact, if it differs from your sign-in address."
        error={errors?.contactEmail?.[0]}
      >
        <Input id="contactEmail" name="contactEmail" type="email" defaultValue={draft.contactEmail ?? ""} />
      </Field>

      <fieldset>
        <legend className="mb-2 text-[13px] font-medium text-ink">
          Research areas <span className="text-clay">*</span>
        </legend>
        {errors?.researchFieldIds?.[0] ? (
          <p role="alert" className="mb-2 text-[12.5px] text-bad">
            {errors.researchFieldIds[0]}
          </p>
        ) : null}
        <CheckboxGrid
          name="researchFieldIds"
          options={fields.map((field) => ({ value: field.id, label: field.name }))}
          initial={selectedFieldIds}
        />
      </fieldset>

      <Field
        label="Short biography"
        htmlFor="biography"
        required
        hint="A few sentences students will read on your listings. What your group works on, and what a student joining would actually do."
        error={errors?.biography?.[0]}
      >
        <Textarea id="biography" name="biography" rows={6} defaultValue={draft.biography ?? ""} required maxLength={2500} />
      </Field>

      <fieldset>
        <legend className="mb-2 text-[13px] font-medium text-ink">
          Who are you recruiting for? <span className="text-clay">*</span>
        </legend>
        <div className="grid gap-2 sm:grid-cols-3">
          <RadioRow
            id="recruit-personally"
            name="recruitingOnBehalfOf"
            value="personally"
            label="Myself"
            defaultChecked={draft.recruitingOnBehalfOf === "personally"}
          />
          <RadioRow
            id="recruit-lab"
            name="recruitingOnBehalfOf"
            value="lab"
            label="My lab or group"
            defaultChecked={draft.recruitingOnBehalfOf === "lab"}
          />
          <RadioRow
            id="recruit-other"
            name="recruitingOnBehalfOf"
            value="another_investigator"
            label="Another investigator"
            defaultChecked={draft.recruitingOnBehalfOf === "another_investigator"}
          />
        </div>
      </fieldset>

      <Field label="Profile photo" htmlFor="photo" hint="Optional. PNG, JPEG, or WebP up to 4 MB.">
        <Input id="photo" name="photo" type="file" accept="image/png,image/jpeg,image/webp" className="py-1.5" />
      </Field>

      <Actions />
    </form>
  );
}

export function ResearcherReviewForm({
  summary,
  verificationStatus,
}: {
  summary: { label: string; value: string }[];
  verificationStatus: string;
}) {
  const [state, action] = useActionState<ActionResult | null, FormData>(submitResearcherForReviewAction, null);

  return (
    <form action={action} className="flex flex-col gap-6">
      <FormError>{state?.ok === false ? state.error : null}</FormError>

      <FormNote>
        {verificationStatus === "verified"
          ? "Your account is already verified. Submitting saves these details and takes you straight to posting a position."
          : "You go straight to posting a position after this. Verification happens in the background: an administrator checks your account and your first listing before students see it, usually within a day. You do not need an institutional email address to get this far, and you will be emailed when verification is done."}
      </FormNote>

      <dl className="divide-y divide-line border-y border-line">
        {summary.map((item) => (
          <div key={item.label} className="grid gap-1 py-3 sm:grid-cols-[200px_1fr] sm:gap-4">
            <dt className="text-[13px] text-subtle">{item.label}</dt>
            <dd className="text-[14px] leading-6 text-ink">{item.value}</dd>
          </div>
        ))}
      </dl>

      <Actions backHref="/onboarding/researcher?step=1" submitLabel="Save and post a position" />
    </form>
  );
}
