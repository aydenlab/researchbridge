"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { ResearchAreaPicker, type PickerField } from "@/components/app/research-area-picker";
import { Button } from "@/components/ui/button";
import { Field, FormError, FormNote, Input, RadioRow, Textarea } from "@/components/ui/field";
import type { ActionResult } from "@/lib/errors";
import { claimFacultyProfileAction } from "./actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending}>
      {pending ? "Saving" : "This is right, take me in"}
    </Button>
  );
}

const SOURCE_LABELS: Record<string, string> = {
  mcmaster_experts: "McMaster Experts",
  linkedin: "LinkedIn",
  faculty_list: "your department's faculty list",
};

export function FacultyClaimForm({
  draft,
  fields,
  selectedFieldIds,
  areas,
  departments,
  source,
}: {
  draft: {
    firstName: string;
    lastName: string;
    title: string;
    department: string;
    labName: string;
    personalWebsite: string;
    linkedinUrl: string;
    biography: string;
    recruitingNeeds: string;
    recruitingOnBehalfOf: string;
  };
  fields: PickerField[];
  selectedFieldIds: string[];
  areas: { disciplines: string[]; disciplineOther: string; researchAreaOther: string };
  departments: string[];
  source: string;
}) {
  const [state, action] = useActionState<ActionResult | null, FormData>(claimFacultyProfileAction, null);
  const errors = state?.ok === false ? state.fieldErrors : undefined;
  const sourceLabel = SOURCE_LABELS[source] ?? source.replace(/_/g, " ");

  return (
    <form action={action} className="flex flex-col gap-6">
      <FormError>{state?.ok === false ? state.error : null}</FormError>

      <FormNote>
        We filled this in from {sourceLabel}. Correct anything that is wrong, tell us what you are looking for, and you
        are done. There is nothing else to complete and no approval to wait for.
      </FormNote>

      <section className="rounded-[12px] border border-line bg-white p-5">
        <h2 className="font-display text-[18px] text-ink">What we have</h2>
        <p className="mt-1 text-[13px] leading-6 text-muted">
          Edit any of it. Students see this beside every position you post.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="First name" htmlFor="firstName" required error={errors?.firstName?.[0]}>
            <Input id="firstName" name="firstName" defaultValue={draft.firstName} required />
          </Field>
          <Field label="Last name" htmlFor="lastName" required error={errors?.lastName?.[0]}>
            <Input id="lastName" name="lastName" defaultValue={draft.lastName} required />
          </Field>
          <Field label="Title" htmlFor="title" error={errors?.title?.[0]}>
            <Input id="title" name="title" defaultValue={draft.title} />
          </Field>
          <Field label="Department" htmlFor="department" required error={errors?.department?.[0]}>
            <Input id="department" name="department" list="claim-departments" defaultValue={draft.department} required />
          </Field>
          <Field label="Lab or group" htmlFor="labName">
            <Input id="labName" name="labName" defaultValue={draft.labName} />
          </Field>
          <Field label="Research page" htmlFor="personalWebsite" error={errors?.personalWebsite?.[0]}>
            <Input id="personalWebsite" name="personalWebsite" defaultValue={draft.personalWebsite} placeholder="https://" />
          </Field>
          <Field label="LinkedIn" htmlFor="linkedinUrl" error={errors?.linkedinUrl?.[0]}>
            <Input id="linkedinUrl" name="linkedinUrl" defaultValue={draft.linkedinUrl} placeholder="https://www.linkedin.com/in/" />
          </Field>
        </div>

        <datalist id="claim-departments">
          {departments.map((department) => (
            <option key={department} value={department} />
          ))}
        </datalist>

        <div className="mt-4">
          <Field
            label="Biography"
            htmlFor="biography"
            error={errors?.biography?.[0]}
            hint="Taken from your public profile. Trim it to whatever a second-year student needs."
          >
            <Textarea id="biography" name="biography" rows={5} defaultValue={draft.biography} maxLength={2500} />
          </Field>
        </div>

        <div className="mt-5">
          <ResearchAreaPicker
            fields={fields}
            initialDisciplines={areas.disciplines}
            initialAreaIds={selectedFieldIds}
            initialDisciplineOther={areas.disciplineOther}
            initialAreaOther={areas.researchAreaOther}
            errors={errors}
          />
        </div>
      </section>

      <section className="rounded-[12px] border border-forest/30 bg-moss/40 p-5">
        <h2 className="font-display text-[18px] text-forest">What you need</h2>
        <p className="mt-1 text-[13px] leading-6 text-forest/85">
          The one thing a faculty list cannot tell us. This is what students read first.
        </p>

        <div className="mt-4">
          <Field
            label="What you are looking for"
            htmlFor="recruitingNeeds"
            required
            error={errors?.recruitingNeeds?.[0]}
            hint="Plain sentences. How many students, doing what, over roughly what period, and anything you will not budge on."
          >
            <Textarea
              id="recruitingNeeds"
              name="recruitingNeeds"
              rows={5}
              defaultValue={draft.recruitingNeeds}
              maxLength={2000}
              placeholder="One or two students for the winter term to help with chart abstraction. No prior research needed, but I want somebody who can commit eight hours a week reliably."
              required
            />
          </Field>
        </div>

        <fieldset className="mt-4">
          <legend className="mb-2 text-[13px] font-medium text-ink">You are recruiting for</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            <RadioRow
              id="claim-personally"
              name="recruitingOnBehalfOf"
              value="personally"
              label="Myself"
              defaultChecked={draft.recruitingOnBehalfOf !== "lab" && draft.recruitingOnBehalfOf !== "another_investigator"}
            />
            <RadioRow
              id="claim-lab"
              name="recruitingOnBehalfOf"
              value="lab"
              label="My lab or group"
              defaultChecked={draft.recruitingOnBehalfOf === "lab"}
            />
            <RadioRow
              id="claim-other"
              name="recruitingOnBehalfOf"
              value="another_investigator"
              label="Another investigator"
              defaultChecked={draft.recruitingOnBehalfOf === "another_investigator"}
            />
          </div>
        </fieldset>
      </section>

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
        <Submit />
        <p className="text-[12.5px] text-muted">Your account is already verified. Nothing is queued for review.</p>
      </div>
    </form>
  );
}
