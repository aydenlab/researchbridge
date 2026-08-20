"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { CheckboxGrid } from "@/components/app/inputs";
import { CriterionRows, OpportunitySkillRows, QuestionRows, type CriterionDraft, type QuestionDraft, type SkillDraft } from "@/components/app/builder-inputs";
import { StepActions } from "@/components/app/onboarding-shell";
import { Field, FormError, FormNote, Input, RadioRow, Select, Textarea } from "@/components/ui/field";
import type { ActionResult } from "@/lib/errors";
import { COMPENSATION_LABELS, COMPENSATION_ORDER } from "@/lib/labels";
import { DEFAULT_PAPER_PROMPT } from "@/lib/validation/opportunity";
import {
  publishOpportunityAction,
  saveCriteriaStepAction,
  saveLogisticsStepAction,
  savePaperStepAction,
  saveProjectStepAction,
  saveQuestionsStepAction,
  saveRoleStepAction,
  saveVideoStepAction,
} from "../../actions";

function Actions({ backHref, submitLabel }: { backHref?: string; submitLabel?: string }) {
  const { pending } = useFormStatus();
  return <StepActions backHref={backHref} submitLabel={submitLabel} pending={pending} />;
}

function base(id: string, step: number) {
  return `/researcher/opportunities/${id}/edit?step=${step}`;
}

export function ProjectStep({
  id,
  draft,
  fields,
  selectedFieldIds,
  departments,
}: {
  id: string;
  draft: { title: string; summary: string; description: string; projectGoals: string; department: string; labName: string };
  fields: { id: string; name: string }[];
  selectedFieldIds: string[];
  departments: string[];
}) {
  const [state, action] = useActionState<ActionResult | null, FormData>(saveProjectStepAction, null);
  const errors = state?.ok === false ? state.fieldErrors : undefined;

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="opportunityId" value={id} />
      <FormError>{state?.ok === false ? state.error : null}</FormError>

      <Field label="Project title" htmlFor="title" required error={errors?.title?.[0]} hint="What a student would see first. Be specific about the work rather than the lab.">
        <Input id="title" name="title" defaultValue={draft.title === "Untitled research position" ? "" : draft.title} placeholder="Undergraduate Research Assistant, Cardiovascular Outcomes" required />
      </Field>

      <Field label="Plain-language summary" htmlFor="summary" required error={errors?.summary?.[0]} hint="One or two sentences. This appears in search results.">
        <Textarea id="summary" name="summary" rows={2} defaultValue={draft.summary} maxLength={400} required />
      </Field>

      <Field label="Detailed research description" htmlFor="description" required error={errors?.description?.[0]} hint="What the project is trying to understand, and what the work actually involves. Honesty about the unglamorous parts attracts better applicants.">
        <Textarea id="description" name="description" rows={10} defaultValue={draft.description} maxLength={8000} required />
      </Field>

      <Field label="Project goal" htmlFor="projectGoals" hint="What finishing this project would produce.">
        <Textarea id="projectGoals" name="projectGoals" rows={2} defaultValue={draft.projectGoals} maxLength={1200} />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Department" htmlFor="department" required error={errors?.department?.[0]}>
          <Input id="department" name="department" list="opportunity-departments" defaultValue={draft.department} required />
        </Field>
        <Field label="Lab or research group" htmlFor="labName">
          <Input id="labName" name="labName" defaultValue={draft.labName} />
        </Field>
      </div>
      <datalist id="opportunity-departments">
        {departments.map((department) => (
          <option key={department} value={department} />
        ))}
      </datalist>

      <fieldset>
        <legend className="mb-2 text-[13px] font-medium text-ink">
          Research fields <span className="text-clay">*</span>
        </legend>
        {errors?.researchFieldIds?.[0] ? (
          <p role="alert" className="mb-2 text-[12.5px] text-bad">
            {errors.researchFieldIds[0]}
          </p>
        ) : null}
        <CheckboxGrid name="researchFieldIds" options={fields.map((field) => ({ value: field.id, label: field.name }))} initial={selectedFieldIds} />
      </fieldset>

      <Actions />
    </form>
  );
}

export function RoleStep({
  id,
  draft,
}: {
  id: string;
  draft: { responsibilities: string; techniques: string; expectedOutputs: string; learningOpportunities: string };
}) {
  const [state, action] = useActionState<ActionResult | null, FormData>(saveRoleStepAction, null);
  const errors = state?.ok === false ? state.fieldErrors : undefined;

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="opportunityId" value={id} />
      <FormError>{state?.ok === false ? state.error : null}</FormError>

      <Field
        label="What the student would actually do"
        htmlFor="responsibilities"
        required
        error={errors?.responsibilities?.[0]}
        hint="One responsibility per line. Concrete tasks are far more useful than a description of the lab."
      >
        <Textarea
          id="responsibilities"
          name="responsibilities"
          rows={8}
          defaultValue={draft.responsibilities}
          placeholder={"Clean and reconcile variables in the admissions extract.\nProduce descriptive summaries for group review.\nAttend the weekly lab meeting."}
          required
        />
      </Field>

      <Field label="Techniques used" htmlFor="techniques" hint="Methods, software, or bench techniques involved.">
        <Textarea id="techniques" name="techniques" rows={2} defaultValue={draft.techniques} maxLength={1200} />
      </Field>

      <Field label="Expected outputs" htmlFor="expectedOutputs" hint="A dataset, a figure, a poster, a co-authored manuscript, or nothing formal.">
        <Textarea id="expectedOutputs" name="expectedOutputs" rows={2} defaultValue={draft.expectedOutputs} maxLength={1200} />
      </Field>

      <Field label="What the student would learn" htmlFor="learningOpportunities">
        <Textarea id="learningOpportunities" name="learningOpportunities" rows={3} defaultValue={draft.learningOpportunities} maxLength={1200} />
      </Field>

      <Actions backHref={base(id, 1)} />
    </form>
  );
}

export function LogisticsStep({
  id,
  draft,
}: {
  id: string;
  draft: {
    numberOfOpenings: number;
    startDate: string;
    duration: string;
    hoursPerWeekMin: string;
    hoursPerWeekMax: string;
    deadline: string;
    locationMode: string;
    location: string;
    compensationType: string;
    compensationDetails: string;
    academicCreditAvailable: boolean;
    beginnerFriendly: boolean;
    priorResearchRequired: boolean;
  };
}) {
  const [state, action] = useActionState<ActionResult | null, FormData>(saveLogisticsStepAction, null);
  const [compensation, setCompensation] = useState(draft.compensationType);
  const errors = state?.ok === false ? state.fieldErrors : undefined;

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="opportunityId" value={id} />
      <FormError>{state?.ok === false ? state.error : null}</FormError>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Number of openings" htmlFor="numberOfOpenings" required error={errors?.numberOfOpenings?.[0]}>
          <Input id="numberOfOpenings" name="numberOfOpenings" type="number" min={1} max={50} defaultValue={draft.numberOfOpenings} required />
        </Field>
        <Field label="Application deadline" htmlFor="deadline" required error={errors?.deadline?.[0]}>
          <Input id="deadline" name="deadline" type="date" defaultValue={draft.deadline} required />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Expected start" htmlFor="startDate">
          <Input id="startDate" name="startDate" type="date" defaultValue={draft.startDate} />
        </Field>
        <Field label="Duration" htmlFor="duration" hint="For example, one academic term or eight months.">
          <Input id="duration" name="duration" defaultValue={draft.duration} />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Minimum hours per week" htmlFor="hoursPerWeekMin" required error={errors?.hoursPerWeekMin?.[0]}>
          <Input id="hoursPerWeekMin" name="hoursPerWeekMin" type="number" min={0} max={60} defaultValue={draft.hoursPerWeekMin} required />
        </Field>
        <Field label="Maximum hours per week" htmlFor="hoursPerWeekMax" required error={errors?.hoursPerWeekMax?.[0]}>
          <Input id="hoursPerWeekMax" name="hoursPerWeekMax" type="number" min={0} max={60} defaultValue={draft.hoursPerWeekMax} required />
        </Field>
      </div>

      <fieldset>
        <legend className="mb-2 text-[13px] font-medium text-ink">Location</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          <RadioRow id="mode-in_person" name="locationMode" value="in_person" label="In person" defaultChecked={draft.locationMode === "in_person"} />
          <RadioRow id="mode-hybrid" name="locationMode" value="hybrid" label="Hybrid" defaultChecked={draft.locationMode === "hybrid"} />
          <RadioRow id="mode-remote" name="locationMode" value="remote" label="Remote" defaultChecked={draft.locationMode === "remote"} />
        </div>
      </fieldset>

      <Field label="Where the work happens" htmlFor="location">
        <Input id="location" name="location" defaultValue={draft.location} placeholder="Hamilton, Ontario" />
      </Field>

      <Field label="Compensation category" htmlFor="compensationType" required error={errors?.compensationType?.[0]} hint="Students see this before they apply. It cannot be hidden.">
        <Select id="compensationType" name="compensationType" value={compensation} onChange={(event) => setCompensation(event.target.value)} required>
          {COMPENSATION_ORDER.map((value) => (
            <option key={value} value={value}>
              {COMPENSATION_LABELS[value]}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        label="Compensation details"
        htmlFor="compensationDetails"
        error={errors?.compensationDetails?.[0]}
        hint={compensation === "paid" ? "Required for paid positions. State the rate or the funding source." : "Optional, but useful. State what a student can actually expect."}
      >
        <Textarea id="compensationDetails" name="compensationDetails" rows={3} defaultValue={draft.compensationDetails} maxLength={1200} />
      </Field>

      {["paid", "work_study", "grant_funded"].includes(compensation) ? (
        <FormNote>
          This position may constitute paid employment. ResearchBridge disables automated candidate ordering for such
          positions. Evidence is organized for you, and every decision stays with you.
        </FormNote>
      ) : null}

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-[13px] font-medium text-ink">Suitability</legend>
        <label className="flex cursor-pointer items-start gap-2.5 rounded-[8px] border border-line bg-white px-3 py-2.5">
          <input type="checkbox" name="academicCreditAvailable" value="true" defaultChecked={draft.academicCreditAvailable} className="mt-0.5 size-4 accent-[#1d4436]" />
          <span className="text-[13.5px] text-ink">Academic credit is available for this position</span>
        </label>
        <label className="flex cursor-pointer items-start gap-2.5 rounded-[8px] border border-line bg-white px-3 py-2.5">
          <input type="checkbox" name="beginnerFriendly" value="true" defaultChecked={draft.beginnerFriendly} className="mt-0.5 size-4 accent-[#1d4436]" />
          <span className="text-[13.5px] text-ink">Suitable for students with no previous research experience</span>
        </label>
        <label className="flex cursor-pointer items-start gap-2.5 rounded-[8px] border border-line bg-white px-3 py-2.5">
          <input type="checkbox" name="priorResearchRequired" value="true" defaultChecked={draft.priorResearchRequired} className="mt-0.5 size-4 accent-[#1d4436]" />
          <span className="text-[13.5px] text-ink">Previous research experience is required</span>
        </label>
      </fieldset>

      <Actions backHref={base(id, 2)} />
    </form>
  );
}

export function CriteriaStep({
  id,
  criteria,
  skills,
  skillSuggestions,
}: {
  id: string;
  criteria: CriterionDraft[];
  skills: SkillDraft[];
  skillSuggestions: string[];
}) {
  const [state, action] = useActionState<ActionResult | null, FormData>(saveCriteriaStepAction, null);

  return (
    <form action={action} className="flex flex-col gap-6">
      <input type="hidden" name="opportunityId" value={id} />
      <FormError>{state?.ok === false ? state.error : null}</FormError>

      <FormNote>
        Students see every criterion on the listing before they apply. Required conditions are evaluated separately from
        preference weighting, and preferred criteria are normalized against each other so no single one can dominate an
        application.
      </FormNote>

      <div>
        <h3 className="mb-3 font-display text-[19px] text-ink" style={{ letterSpacing: "-0.4px" }}>
          Criteria
        </h3>
        <CriterionRows initial={criteria} />
      </div>

      <div className="border-t border-line pt-6">
        <h3 className="mb-1 font-display text-[19px] text-ink" style={{ letterSpacing: "-0.4px" }}>
          Skill tags
        </h3>
        <p className="mb-3 text-[13.5px] leading-6 text-muted">
          These appear on the listing card so students can scan for fit. Marking a skill as not required is a useful
          signal on its own.
        </p>
        <OpportunitySkillRows initial={skills} suggestions={skillSuggestions} />
      </div>

      <Actions backHref={base(id, 3)} />
    </form>
  );
}

export function QuestionsStep({ id, questions }: { id: string; questions: QuestionDraft[] }) {
  const [state, action] = useActionState<ActionResult | null, FormData>(saveQuestionsStepAction, null);

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="opportunityId" value={id} />
      <FormError>{state?.ok === false ? state.error : null}</FormError>

      <FormNote>
        A project-specific question is the single most effective filter against generic applications. The paper response
        and video response are configured on the next two steps.
      </FormNote>

      <QuestionRows initial={questions} />

      <Actions backHref={base(id, 4)} />
    </form>
  );
}

export function PaperStep({
  id,
  draft,
}: {
  id: string;
  draft: {
    materialTitle: string;
    materialAuthors: string;
    materialUrl: string;
    materialDoi: string;
    materialAbstract: string;
    materialContext: string;
    paperPrompt: string;
    includePaperQuestion: boolean;
  };
}) {
  const [state, action] = useActionState<ActionResult | null, FormData>(savePaperStepAction, null);
  const [enabled, setEnabled] = useState(draft.includePaperQuestion);

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="opportunityId" value={id} />
      <FormError>{state?.ok === false ? state.error : null}</FormError>

      <FormNote>
        Attaching a paper is optional. When you do, students are told plainly to read it before applying, and their
        response becomes part of the application you review. ResearchBridge does not claim to detect whether someone
        really read it. Your judgment does that.
      </FormNote>

      <Field label="Paper or preprint title" htmlFor="materialTitle">
        <Input id="materialTitle" name="materialTitle" defaultValue={draft.materialTitle} />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Authors" htmlFor="materialAuthors">
          <Input id="materialAuthors" name="materialAuthors" defaultValue={draft.materialAuthors} />
        </Field>
        <Field label="DOI" htmlFor="materialDoi">
          <Input id="materialDoi" name="materialDoi" defaultValue={draft.materialDoi} placeholder="10.0000/example" />
        </Field>
      </div>

      <Field label="Link to the paper" htmlFor="materialUrl" hint="Students open this in a new tab.">
        <Input id="materialUrl" name="materialUrl" type="url" defaultValue={draft.materialUrl} placeholder="https://" />
      </Field>

      <Field label="Abstract" htmlFor="materialAbstract">
        <Textarea id="materialAbstract" name="materialAbstract" rows={4} defaultValue={draft.materialAbstract} maxLength={3000} />
      </Field>

      <Field label="Context for students" htmlFor="materialContext" hint="What to pay attention to, in your own words.">
        <Textarea id="materialContext" name="materialContext" rows={3} defaultValue={draft.materialContext} maxLength={1200} />
      </Field>

      <label className="flex cursor-pointer items-start gap-2.5 rounded-[8px] border border-line bg-white px-3 py-2.5">
        <input
          type="checkbox"
          name="includePaperQuestion"
          value="true"
          checked={enabled}
          onChange={(event) => setEnabled(event.target.checked)}
          className="mt-0.5 size-4 accent-[#1d4436]"
        />
        <span className="text-[13.5px] text-ink">Ask applicants to respond to this paper</span>
      </label>

      <Field label="Paper response prompt" htmlFor="paperPrompt" hint="Edit this freely. The default is a starting point.">
        <Textarea
          id="paperPrompt"
          name="paperPrompt"
          rows={4}
          defaultValue={draft.paperPrompt || DEFAULT_PAPER_PROMPT}
          maxLength={1200}
          disabled={!enabled}
        />
      </Field>

      <Actions backHref={base(id, 5)} />
    </form>
  );
}

export function VideoStep({
  id,
  draft,
  featureEnabled,
}: {
  id: string;
  draft: { videoResponseEnabled: boolean; videoPrompt: string; videoMaxSeconds: number };
  featureEnabled: boolean;
}) {
  const [state, action] = useActionState<ActionResult | null, FormData>(saveVideoStepAction, null);
  const [enabled, setEnabled] = useState(draft.videoResponseEnabled);

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="opportunityId" value={id} />
      <FormError>{state?.ok === false ? state.error : null}</FormError>

      <FormNote>
        {featureEnabled
          ? "Video is off by default and is never a ResearchBridge requirement. Students record wherever they like and share a link. Nothing about appearance, delivery, or voice is analyzed, and no automated assessment is produced from it."
          : "Video responses are switched off for this pilot. The question type exists in the data model, so it can be enabled later without changing existing listings."}
      </FormNote>

      <label className="flex cursor-pointer items-start gap-2.5 rounded-[8px] border border-line bg-white px-3 py-2.5">
        <input
          type="checkbox"
          name="videoResponseEnabled"
          value="true"
          checked={enabled}
          disabled={!featureEnabled}
          onChange={(event) => setEnabled(event.target.checked)}
          className="mt-0.5 size-4 accent-[#1d4436]"
        />
        <span className="text-[13.5px] text-ink">Ask applicants for a short video response</span>
      </label>

      <Field label="Video prompt" htmlFor="videoPrompt">
        <Textarea id="videoPrompt" name="videoPrompt" rows={3} defaultValue={draft.videoPrompt} maxLength={600} disabled={!enabled} />
      </Field>

      <Field label="Target length in seconds" htmlFor="videoMaxSeconds" hint="Between 15 and 180 seconds. Around 30 to 60 works well.">
        <Input id="videoMaxSeconds" name="videoMaxSeconds" type="number" min={15} max={180} defaultValue={draft.videoMaxSeconds} disabled={!enabled} />
      </Field>

      <Actions backHref={base(id, 6)} />
    </form>
  );
}

export function PublishStep({ id, alreadyPublished }: { id: string; alreadyPublished: boolean }) {
  const [state, action] = useActionState<ActionResult | null, FormData>(publishOpportunityAction, null);

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="opportunityId" value={id} />
      <FormError>{state?.ok === false ? state.error : null}</FormError>

      <FormNote>
        Publishing makes this listing visible to students at your institution and lets them start applications
        immediately. You can close or unpublish it at any time, and applications are preserved either way.
      </FormNote>

      <label className="flex cursor-pointer items-start gap-2.5 rounded-[8px] border border-line bg-white px-3 py-2.5">
        <input type="checkbox" name="confirm" value="true" required className="mt-0.5 size-4 accent-[#1d4436]" />
        <span className="text-[13.5px] leading-6 text-ink">
          I confirm this is a genuine research position I am authorized to recruit for, and that the responsibilities,
          time commitment, and compensation stated here are accurate.
        </span>
      </label>

      <Actions backHref={base(id, 8)} submitLabel={alreadyPublished ? "Update published listing" : "Publish opportunity"} />
    </form>
  );
}
