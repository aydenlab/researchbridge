"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { PhotoField } from "@/components/app/photo-field";
import { ResearchAreaPicker, type PickerField } from "@/components/app/research-area-picker";
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
  personalWebsite: string | null;
  linkedinUrl: string | null;
  orcidId: string | null;
  contactEmail: string | null;
  biography: string | null;
  recruitingOnBehalfOf: string | null;
  disciplines: string[];
  disciplineOther: string | null;
  researchAreaOther: string | null;
  photoUrl: string | null;
};

export function ResearcherDetailsForm({
  draft,
  fields,
  selectedFieldIds,
  faculties,
  departments,
}: {
  draft: ResearcherDraft;
  fields: PickerField[];
  selectedFieldIds: string[];
  faculties: string[];
  departments: string[];
}) {
  const [state, action] = useActionState<ActionResult | null, FormData>(saveResearcherDetailsAction, null);
  const errors = state?.ok === false ? state.fieldErrors : undefined;

  // A rejected URL or ORCID is no use inside a collapsed section.
  const optionalHasError = ["personalWebsite", "linkedinUrl", "orcidId", "contactEmail"].some(
    (key) => errors?.[key]?.length,
  );

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
        <Field label="Department" htmlFor="department" required error={errors?.department?.[0]}>
          <Input id="department" name="department" list="departments" defaultValue={draft.department ?? ""} required />
        </Field>
        <Field label="Lab or research group" htmlFor="labName">
          <Input id="labName" name="labName" defaultValue={draft.labName ?? ""} />
        </Field>
      </div>
      <datalist id="departments">
        {departments.map((department) => (
          <option key={department} value={department} />
        ))}
      </datalist>

      <ResearchAreaPicker
        fields={fields}
        initialDisciplines={draft.disciplines}
        initialAreaIds={selectedFieldIds}
        initialDisciplineOther={draft.disciplineOther ?? ""}
        initialAreaOther={draft.researchAreaOther ?? ""}
        errors={errors}
      />

      <Field
        label="Short biography"
        htmlFor="biography"
        hint="A few sentences students will read on your listings. What your group works on, and what a student joining would actually do."
        error={errors?.biography?.[0]}
      >
        <Textarea id="biography" name="biography" rows={4} defaultValue={draft.biography ?? ""} maxLength={2500} />
      </Field>

      <PhotoField currentUrl={draft.photoUrl} name={[draft.firstName, draft.lastName].filter(Boolean).join(" ")} />

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

      {/*
        Everything a researcher can skip lives behind one disclosure. Seven
        optional fields in the open turn a five-minute sign-up into something
        that looks like a grant application, and none of them gate the account.
      */}
      <details open={optionalHasError || undefined} className="rounded-[10px] border border-line bg-shell/40 px-4 py-3">
        <summary className="cursor-pointer text-[13px] font-medium text-ink">
          Links and other optional details
        </summary>
        <p className="mt-1 text-[12.5px] leading-5 text-muted">
          All optional. You can add any of these later from your profile.
        </p>

        <div className="mt-4 flex flex-col gap-5">
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
            <Field
              label="Research page"
              htmlFor="personalWebsite"
              hint="Your faculty or lab page, whichever describes the work."
              error={errors?.personalWebsite?.[0]}
            >
              <Input id="personalWebsite" name="personalWebsite" type="url" defaultValue={draft.personalWebsite ?? ""} placeholder="https://" />
            </Field>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="LinkedIn" htmlFor="linkedinUrl" error={errors?.linkedinUrl?.[0]}>
              <Input id="linkedinUrl" name="linkedinUrl" type="url" defaultValue={draft.linkedinUrl ?? ""} placeholder="https://www.linkedin.com/in/" />
            </Field>
            <Field
              label="ORCID iD"
              htmlFor="orcidId"
              hint="Students use it to find your published work."
              error={errors?.orcidId?.[0]}
            >
              <Input id="orcidId" name="orcidId" type="text" defaultValue={draft.orcidId ?? ""} placeholder="0000-0002-1825-0097" />
            </Field>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label="Contact email"
              htmlFor="contactEmail"
              hint="Shown to students you contact, if it differs from your sign-in address."
              error={errors?.contactEmail?.[0]}
            >
              <Input id="contactEmail" name="contactEmail" type="email" defaultValue={draft.contactEmail ?? ""} />
            </Field>
          </div>
        </div>
      </details>

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
          ? "Your account is already verified. Submitting saves these details and puts your profile live."
          : "Submitting puts your profile live. Verification happens in the background: an administrator checks your account and your first listing before students see it, usually within a day. You do not need an institutional email address to get this far, and you will be emailed when verification is done."}
      </FormNote>

      <dl className="divide-y divide-line border-y border-line">
        {summary.map((item) => (
          <div key={item.label} className="grid gap-1 py-3 sm:grid-cols-[200px_1fr] sm:gap-4">
            <dt className="text-[13px] text-subtle">{item.label}</dt>
            <dd className="text-[14px] leading-6 text-ink">{item.value}</dd>
          </div>
        ))}
      </dl>

      <Actions backHref="/onboarding/researcher?step=1" submitLabel="Create my profile" />
    </form>
  );
}
