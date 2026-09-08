"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { TokenField } from "@/components/app/inputs";
import { Button, ButtonLink } from "@/components/ui/button";
import { CheckboxRow, Field, FormError, FormNote, Input, Textarea } from "@/components/ui/field";
import type { ActionResult } from "@/lib/errors";
import { DURATION_LABELS, DURATION_ORDER, LOCATION_LABELS } from "@/lib/labels";
import { createSimpleOpportunityAction } from "../actions";
import { OptionGrid } from "./option-grid";
import { WeightSliders } from "./weight-sliders";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending}>
      {pending ? "Posting" : "Post opportunity"}
    </Button>
  );
}

const OUTCOME_OPTIONS = [
  { value: "authorship", label: "Authorship", description: "Named on a manuscript." },
  { value: "poster", label: "Poster", description: "Presented at a departmental or student event." },
  { value: "conference", label: "Conference presentation" },
  { value: "thesis", label: "Thesis project", description: "Work a student can carry into a thesis." },
  { value: "publication", label: "Publication" },
];

// The same fixed list the schema and the matching engine use. Duration is a
// matching dimension now, so a short-term/long-term split here would not survive
// being saved, and a supervisor open to either length has to be able to say so.
const DURATION_OPTIONS = DURATION_ORDER.map((value) => ({ value, label: DURATION_LABELS[value] }));

const COMPENSATION_OPTIONS = [
  { value: "volunteer", label: "Volunteer", description: "Unpaid. Students see this before they apply." },
  { value: "paid", label: "Paid", description: "Salary, stipend, work study, or grant funding." },
];

const LOCATION_OPTIONS = [
  { value: "remote", label: LOCATION_LABELS.remote },
  { value: "in_person", label: LOCATION_LABELS.in_person },
  { value: "hybrid", label: LOCATION_LABELS.hybrid },
];

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[12px] border border-line bg-white px-5 py-5 sm:px-6 sm:py-6">
      <h2 className="font-display text-[19px] text-ink" style={{ letterSpacing: "-0.4px" }}>
        {title}
      </h2>
      {description ? <p className="mt-1.5 rb-measure text-[13.5px] leading-6 text-muted">{description}</p> : null}
      <div className="mt-4 flex flex-col gap-5">{children}</div>
    </section>
  );
}

function Legend({ label, required }: { label: string; required?: boolean }) {
  return (
    <legend className="mb-2 text-[13px] font-medium text-ink">
      {label}
      {required ? (
        <span className="ml-1 text-clay">*</span>
      ) : (
        <span className="ml-1.5 text-[11.5px] font-normal text-subtle">Optional</span>
      )}
    </legend>
  );
}

export function SimpleOpportunityForm({
  fields,
  skillGroups,
  department,
}: {
  fields: { id: string; name: string }[];
  skillGroups: { category: string; skills: string[] }[];
  department: string;
}) {
  const [state, action] = useActionState<ActionResult | null, FormData>(createSimpleOpportunityAction, null);
  const fieldErrors = state?.ok === false ? state.fieldErrors : undefined;

  return (
    <form action={action} className="flex flex-col gap-6">
      <Section
        title="The project"
        description="Write it the way you would describe it to a second-year student who has never worked in a lab."
      >
        <Field
          label="Project title"
          htmlFor="title"
          required
          hint="What a student sees first. Be specific about the work rather than the lab."
        >
          <Input
            id="title"
            name="title"
            placeholder="Undergraduate Research Assistant, Cardiovascular Outcomes"
            maxLength={180}
            required
          />
        </Field>

        <Field
          label="Plain-language summary"
          htmlFor="summary"
          required
          hint="One or two sentences. This appears in search results."
          error={fieldErrors?.summary?.[0]}
        >
          <Textarea id="summary" name="summary" rows={2} maxLength={400} required />
        </Field>

        <Field
          label="What the student will do"
          htmlFor="responsibilities"
          required
          hint="The actual work, week to week. Honesty about the unglamorous parts attracts better applicants."
          error={fieldErrors?.responsibilities?.[0]}
        >
          <Textarea id="responsibilities" name="responsibilities" rows={4} maxLength={4000} required />
        </Field>

        <Field
          label="Additional information"
          htmlFor="additionalInfo"
          required
          hint="The research itself: background, techniques, and what the project is trying to answer."
          error={fieldErrors?.additionalInfo?.[0]}
        >
          <Textarea id="additionalInfo" name="additionalInfo" rows={8} maxLength={8000} required />
        </Field>

        <Field
          label="Department"
          htmlFor="department"
          required
          hint="Prefilled from your profile."
          error={fieldErrors?.department?.[0]}
        >
          <Input id="department" name="department" defaultValue={department} maxLength={160} required />
        </Field>

        <Field
          label="Application deadline"
          htmlFor="deadline"
          required
          className="sm:max-w-[260px]"
          error={fieldErrors?.deadline?.[0]}
        >
          <Input id="deadline" name="deadline" type="date" required />
        </Field>
      </Section>

      <Section title="Field and outcomes" description="What the project belongs to, and what a student would walk away with.">
        <fieldset>
          <Legend label="Research field" required />
          <OptionGrid type="radio" name="researchFieldId" options={fields.map((field) => ({ value: field.id, label: field.name }))} required />
        </fieldset>

        <fieldset>
          <Legend label="Project outcomes" />
          <OptionGrid
            type="checkbox"
            name="outcomes"
            options={OUTCOME_OPTIONS}
            columns={2}
          />
        </fieldset>
      </Section>

      <Section
        title="Required skills"
        description="Select what this project actually needs. Students see these on the listing, so a short list is more useful than a long one."
      >
        {skillGroups.map((group) => (
          <fieldset key={group.category}>
            <legend className="mb-2 text-[12px] font-medium text-subtle">{group.category}</legend>
            <OptionGrid
              type="checkbox"
              name="skillName"
              columns={4}
              options={group.skills.map((skill) => ({ value: skill, label: skill }))}
            />
          </fieldset>
        ))}

        <div className="border-t border-line pt-5">
          <TokenField
            name="otherSkillName"
            label="Other skills"
            hint="Anything the list above does not cover. Press Enter to add each one."
            placeholder="Optical coherence tomography"
          />
        </div>
      </Section>

      <Section title="Logistics" description="Students filter on all three of these before they read anything else.">
        <fieldset>
          <Legend label="Duration" required />
          <p className="-mt-1 mb-2 text-[12.5px] leading-5 text-muted">
            Choose every length you would consider. Students are matched on the overlap, so saying yes to two is a
            wider net rather than a vaguer answer.
          </p>
          <OptionGrid
            type="checkbox"
            name="preferredDurations"
            options={DURATION_OPTIONS}
            columns={3}
            selectAllLabel="Open to any length"
          />
          <FormError>{fieldErrors?.preferredDurations?.[0]}</FormError>
        </fieldset>

        <fieldset>
          <Legend label="Hours per week" required />
          <div className="grid gap-3 sm:max-w-[380px] sm:grid-cols-2">
            <Field label="Minimum" htmlFor="hoursPerWeekMin" required error={fieldErrors?.hoursPerWeekMin?.[0]}>
              <Input id="hoursPerWeekMin" name="hoursPerWeekMin" type="number" min={0} max={60} defaultValue={6} required />
            </Field>
            <Field label="Maximum" htmlFor="hoursPerWeekMax" required error={fieldErrors?.hoursPerWeekMax?.[0]}>
              <Input id="hoursPerWeekMax" name="hoursPerWeekMax" type="number" min={0} max={60} defaultValue={10} required />
            </Field>
          </div>
        </fieldset>

        <fieldset>
          <Legend label="Compensation" required />
          <OptionGrid type="radio" name="compensation" options={COMPENSATION_OPTIONS} columns={2} required />
          <Field
            label="Pay arrangement"
            htmlFor="compensationDetails"
            hint="Required if the position is paid. Say the rate or the funding source."
            error={fieldErrors?.compensationDetails?.[0]}
            className="mt-3"
          >
            <Input id="compensationDetails" name="compensationDetails" maxLength={1200} />
          </Field>
        </fieldset>

        <fieldset>
          <Legend label="Location" required />
          <OptionGrid type="radio" name="locationMode" options={LOCATION_OPTIONS} required />
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <Legend label="Suitability" />
          <CheckboxRow
            id="academicCreditAvailable"
            name="academicCreditAvailable"
            value="true"
            label="Academic credit is available for this position"
          />
          <CheckboxRow
            id="beginnerFriendly"
            name="beginnerFriendly"
            value="true"
            label="Suitable for students with no previous research experience"
          />
          <CheckboxRow
            id="priorResearchRequired"
            name="priorResearchRequired"
            value="true"
            label="Previous research experience is required"
          />
        </fieldset>
      </Section>

      <Section
        title="What matters most"
        description="Set each of these to whatever this project actually depends on. Nothing here orders candidates for you; it decides which evidence is surfaced first when you review them."
      >
        <WeightSliders />
      </Section>

      <FormNote>
        Posting from this page publishes the listing straight away. The nine-step wizard at
        /researcher/opportunities/new is still there when you want application questions, screening criteria, or a
        writing sample attached to the position.
      </FormNote>

      {state?.ok === false ? <FormError>{state.error}</FormError> : null}

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-6">
        <Submit />
        <ButtonLink href="/researcher/opportunities" variant="outline">
          Cancel
        </ButtonLink>
      </div>
    </form>
  );
}
