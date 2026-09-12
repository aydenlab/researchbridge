"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { TokenField } from "@/components/app/inputs";
import { Button, ButtonLink } from "@/components/ui/button";
import { CheckboxRow, Field, FormError, FormNote, Input, Textarea } from "@/components/ui/field";
import type { FormValues, ResubmitResult } from "@/lib/action-utils";
import { DURATION_LABELS, DURATION_ORDER, LOCATION_LABELS, PROJECT_OUTCOME_LABELS } from "@/lib/labels";
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

const OUTCOME_DESCRIPTIONS: Record<string, string> = {
  authorship: "Named on a manuscript.",
  poster: "Presented at a departmental or student event.",
  thesis: "Work a student can carry into a thesis.",
};

const OUTCOME_OPTIONS = Object.entries(PROJECT_OUTCOME_LABELS).map(([value, label]) => ({
  value,
  label,
  description: OUTCOME_DESCRIPTIONS[value],
}));

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
  verified,
}: {
  fields: { id: string; name: string }[];
  skillGroups: { category: string; skills: string[] }[];
  department: string;
  /** An unverified account can still post; the listing waits for a reviewer. */
  verified: boolean;
}) {
  const [state, action] = useActionState<ResubmitResult | null, FormData>(createSimpleOpportunityAction, null);
  const fieldErrors = state?.ok === false ? state.fieldErrors : undefined;
  const submitted: FormValues = (state?.ok === false ? state.values : undefined) ?? {};

  /**
   * React empties an uncontrolled form once its action returns. A refusal hands
   * the submission back, and remounting the form on that is what puts it in
   * front of the researcher again: every field below reads its default from the
   * refused submission, so nothing typed is lost to a validation message.
   */
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (state?.ok === false) setAttempt((count) => count + 1);
  }, [state]);

  const text = (name: string, fallback = "") => submitted[name]?.[0] ?? fallback;
  const chosen = (name: string) => submitted[name] ?? [];
  const checked = (name: string) => (submitted[name] ?? []).length > 0;

  return (
    <form key={attempt} action={action} className="flex flex-col gap-6">
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
            defaultValue={text("title")}
            maxLength={180}
            required
          />
        </Field>

        <Field
          label="Plain-language summary"
          htmlFor="summary"
          hint="One or two sentences. This appears in search results."
          error={fieldErrors?.summary?.[0]}
        >
          <Textarea id="summary" name="summary" rows={2} defaultValue={text("summary")} maxLength={400} />
        </Field>

        <Field
          label="Department"
          htmlFor="department"
          required
          hint="Prefilled from your profile."
          error={fieldErrors?.department?.[0]}
        >
          <Input id="department" name="department" defaultValue={text("department", department)} maxLength={160} required />
        </Field>

        <Field
          label="Application deadline"
          htmlFor="deadline"
          required
          className="sm:max-w-[260px]"
          error={fieldErrors?.deadline?.[0]}
        >
          <Input id="deadline" name="deadline" type="date" defaultValue={text("deadline")} required />
        </Field>
      </Section>

      <Section title="Field and outcomes" description="What the project belongs to, and what a student would walk away with.">
        <fieldset>
          <Legend label="Research field" required />
          <OptionGrid
            type="radio"
            name="researchFieldId"
            options={fields.map((field) => ({ value: field.id, label: field.name }))}
            initial={chosen("researchFieldId")}
            required
          />
        </fieldset>

        <fieldset>
          <Legend label="Project outcomes" />
          <OptionGrid type="checkbox" name="outcomes" options={OUTCOME_OPTIONS} initial={chosen("outcomes")} columns={2} />
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
              initial={chosen("skillName")}
              options={group.skills.map((skill) => ({ value: skill, label: skill }))}
            />
          </fieldset>
        ))}

        <div className="border-t border-line pt-5">
          <TokenField
            name="otherSkillName"
            initial={chosen("otherSkillName")}
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
            initial={chosen("preferredDurations")}
            columns={3}
            selectAllLabel="Open to any length"
          />
          <FormError>{fieldErrors?.preferredDurations?.[0]}</FormError>
        </fieldset>

        <fieldset>
          <Legend label="Compensation" required />
          <OptionGrid
            type="radio"
            name="compensation"
            options={COMPENSATION_OPTIONS}
            initial={chosen("compensation")}
            columns={2}
            required
          />
        </fieldset>

        <fieldset>
          <Legend label="Location" required />
          <OptionGrid type="radio" name="locationMode" options={LOCATION_OPTIONS} initial={chosen("locationMode")} required />
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <Legend label="Suitability" />
          <CheckboxRow
            id="academicCreditAvailable"
            name="academicCreditAvailable"
            value="true"
            defaultChecked={checked("academicCreditAvailable")}
            label="Academic credit is available for this position"
          />
          <CheckboxRow
            id="beginnerFriendly"
            name="beginnerFriendly"
            value="true"
            defaultChecked={checked("beginnerFriendly")}
            label="Suitable for students with no previous research experience"
          />
          <CheckboxRow
            id="priorResearchRequired"
            name="priorResearchRequired"
            value="true"
            defaultChecked={checked("priorResearchRequired")}
            label="Previous research experience is required"
          />
        </fieldset>
      </Section>

      <Section
        title="What matters most"
        description="Set each of these to whatever this project actually depends on. Nothing here orders candidates for you; it decides which evidence is surfaced first when you review them."
      >
        <WeightSliders initial={submitted} />
      </Section>

      <FormNote>
        {verified
          ? "Posting publishes the listing straight away. Application questions, screening criteria, a paper to respond to, and a video prompt are all added afterwards by editing the position."
          : "Your account is still being verified, so this listing is submitted for review rather than published. You do not have to wait here for that; you can keep editing it in the meantime."}
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
