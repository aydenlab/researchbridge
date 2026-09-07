"use client";

import { TokenField } from "@/components/app/inputs";
import { Button, ButtonLink } from "@/components/ui/button";
import { CheckboxRow, Field, FormNote, Input, Textarea } from "@/components/ui/field";
import { LOCATION_LABELS } from "@/lib/labels";
import { OptionGrid } from "./option-grid";
import { WeightSliders } from "./weight-sliders";

const OUTCOME_OPTIONS = [
  { value: "authorship", label: "Authorship", description: "Named on a manuscript." },
  { value: "poster", label: "Poster", description: "Presented at a departmental or student event." },
  { value: "conference", label: "Conference presentation" },
  { value: "thesis", label: "Thesis project", description: "Work a student can carry into a thesis." },
  { value: "publication", label: "Publication" },
];

const DURATION_OPTIONS = [
  { value: "short_term", label: "Short-term", description: "A single term or less." },
  { value: "long_term", label: "Long-term", description: "Two terms or more." },
];

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
}: {
  fields: { id: string; name: string }[];
  skillGroups: { category: string; skills: string[] }[];
}) {
  return (
    <form onSubmit={(event) => event.preventDefault()} className="flex flex-col gap-6">
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
          hint="One or two sentences. This appears in search results."
        >
          <Textarea id="summary" name="summary" rows={2} maxLength={400} />
        </Field>

        <Field
          label="Additional information"
          htmlFor="additionalInfo"
          hint="Responsibilities, techniques, expectations, anything else worth knowing. Honesty about the unglamorous parts attracts better applicants."
        >
          <Textarea id="additionalInfo" name="additionalInfo" rows={8} maxLength={8000} />
        </Field>

        <Field label="Application deadline" htmlFor="deadline" required className="sm:max-w-[260px]">
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
          <OptionGrid type="radio" name="duration" options={DURATION_OPTIONS} columns={2} required />
        </fieldset>

        <fieldset>
          <Legend label="Compensation" required />
          <OptionGrid type="radio" name="compensation" options={COMPENSATION_OPTIONS} columns={2} required />
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
        This form is not connected yet. Submitting does nothing, and nothing is saved. The nine-step wizard at
        /researcher/opportunities/new is still the way to post a live listing.
      </FormNote>

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-6">
        <Button type="submit" size="lg">
          Post opportunity
        </Button>
        <ButtonLink href="/researcher/opportunities" variant="outline">
          Cancel
        </ButtonLink>
      </div>
    </form>
  );
}
