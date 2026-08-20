"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Input, Select, Textarea } from "@/components/ui/field";
import { CRITERION_TYPE_LABELS, QUESTION_TYPE_LABELS, REQUIREMENT_LABELS } from "@/lib/labels";

const CONFIG_HINTS: Record<string, { label: string; placeholder: string; hint: string }> = {
  skill: { label: "Skill name", placeholder: "Python", hint: "Matched against the skills a student lists on their profile." },
  coursework: { label: "Course codes", placeholder: "STATS 2B03, STATS 3Y03", hint: "Separate alternatives with commas. Any one of them counts." },
  program: { label: "Programs", placeholder: "Health Sciences, Nursing", hint: "Separate with commas. Partial matches count." },
  year_level: { label: "Minimum year", placeholder: "2", hint: "Students below this year are marked as not meeting it." },
  availability: { label: "Minimum hours per week", placeholder: "8", hint: "Compared directly against the hours a student states." },
  prior_research: { label: "Minimum experiences", placeholder: "1", hint: "Leave at 1 unless you need more than one prior role." },
  research_interest: { label: "Research fields", placeholder: "Epidemiology, Cardiology", hint: "Separate with commas." },
  technique: { label: "Keywords", placeholder: "MRI, preprocessing, EEG", hint: "Used to find related descriptions in written answers." },
  academic_metric: { label: "Minimum value", placeholder: "9", hint: "On the McMaster 12 point scale. Students on other scales are marked as not enough information." },
  written_response: { label: "Not applicable", placeholder: "", hint: "Assessed from written answers rather than a stored field." },
  custom: { label: "Not applicable", placeholder: "", hint: "Assessed from written answers rather than a stored field." },
};

export type CriterionDraft = {
  type: string;
  label: string;
  description: string;
  importance: string;
  configValue: string;
};

const EMPTY_CRITERION: CriterionDraft = {
  type: "skill",
  label: "",
  description: "",
  importance: "medium",
  configValue: "",
};

function CriterionRow({ index, draft, onRemove }: { index: number; draft: CriterionDraft; onRemove: () => void }) {
  const [type, setType] = useState(draft.type);
  const [importance, setImportance] = useState(draft.importance);
  const hint = CONFIG_HINTS[type] ?? CONFIG_HINTS.custom;
  const showConfig = !["written_response", "custom"].includes(type);

  return (
    <fieldset className="rounded-[10px] border border-line bg-shell/50 p-4">
      <legend className="px-1 text-[12px] font-medium uppercase tracking-[0.1em] text-subtle">
        Criterion {index + 1}
      </legend>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`criterionType-${index}`} className="text-[13px] font-medium text-ink">
            Type
          </label>
          <Select
            id={`criterionType-${index}`}
            name="criterionType"
            value={type}
            onChange={(event) => setType(event.target.value)}
          >
            {Object.entries(CRITERION_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={`criterionImportance-${index}`} className="text-[13px] font-medium text-ink">
            How much it matters
          </label>
          <Select
            id={`criterionImportance-${index}`}
            name="criterionImportance"
            value={importance}
            onChange={(event) => setImportance(event.target.value)}
          >
            <option value="required">Required</option>
            <option value="high">Preferred, high importance</option>
            <option value="medium">Preferred, medium importance</option>
            <option value="low">Preferred, low importance</option>
          </Select>
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-1.5">
        <label htmlFor={`criterionLabel-${index}`} className="text-[13px] font-medium text-ink">
          What you are asking for
        </label>
        <Input
          id={`criterionLabel-${index}`}
          name="criterionLabel"
          defaultValue={draft.label}
          placeholder="Availability of at least 8 hours per week"
        />
      </div>

      <div className="mt-3 flex flex-col gap-1.5">
        <label htmlFor={`criterionDescription-${index}`} className="text-[13px] font-medium text-ink">
          Explanation for students
        </label>
        <Input
          id={`criterionDescription-${index}`}
          name="criterionDescription"
          defaultValue={draft.description}
          placeholder="Optional. Students see this on the listing."
        />
      </div>

      <div className="mt-3 flex flex-col gap-1.5">
        <label htmlFor={`criterionConfig-${index}`} className="text-[13px] font-medium text-ink">
          {hint.label}
        </label>
        <Input
          id={`criterionConfig-${index}`}
          name="criterionConfig"
          defaultValue={draft.configValue}
          placeholder={hint.placeholder}
          disabled={!showConfig}
        />
        <p className="text-[12px] leading-5 text-muted">{hint.hint}</p>
      </div>

      <p className="mt-3 rounded-[8px] border border-line bg-white px-3 py-2 text-[12px] leading-5 text-muted">
        {importance === "required"
          ? "Required conditions are evaluated separately from preference weighting. A candidate who does not meet one is flagged rather than quietly downgraded."
          : "Preferred criteria are weighted against each other. Missing this one affects only its own share of the assessment, never the rest of the application."}
      </p>

      <button
        type="button"
        onClick={onRemove}
        className="mt-3 inline-flex h-9 items-center rounded-full border border-line-strong px-4 text-[13px] text-muted transition-colors hover:border-bad/40 hover:text-bad"
      >
        Remove this criterion
      </button>
    </fieldset>
  );
}

export function CriterionRows({ initial }: { initial: CriterionDraft[] }) {
  const [rows, setRows] = useState<CriterionDraft[]>(initial.length > 0 ? initial : [{ ...EMPTY_CRITERION }]);

  return (
    <div className="flex flex-col gap-4">
      {rows.map((row, index) => (
        <CriterionRow
          key={index}
          index={index}
          draft={row}
          onRemove={() => setRows(rows.filter((_, position) => position !== index))}
        />
      ))}
      <button
        type="button"
        onClick={() => setRows([...rows, { ...EMPTY_CRITERION }])}
        className="inline-flex h-9 w-fit items-center gap-1.5 rounded-full border border-line-strong bg-white px-4 text-[13px] text-ink transition-colors hover:bg-shell"
      >
        <Plus className="size-3.5" aria-hidden="true" />
        Add criterion
      </button>
    </div>
  );
}

export type SkillDraft = { name: string; level: string };

export function OpportunitySkillRows({ initial, suggestions }: { initial: SkillDraft[]; suggestions: string[] }) {
  const [rows, setRows] = useState<SkillDraft[]>(initial.length > 0 ? initial : [{ name: "", level: "preferred" }]);

  return (
    <div className="flex flex-col gap-2.5">
      <datalist id="opportunity-skill-options">
        {suggestions.map((item) => (
          <option key={item} value={item} />
        ))}
      </datalist>

      {rows.map((row, index) => (
        <div key={index} className="grid gap-2.5 sm:grid-cols-[1.4fr_1fr_auto]">
          <div>
            <label htmlFor={`opportunitySkillName-${index}`} className="sr-only">
              Skill {index + 1}
            </label>
            <Input
              id={`opportunitySkillName-${index}`}
              name="opportunitySkillName"
              list="opportunity-skill-options"
              defaultValue={row.name}
              placeholder="Python"
            />
          </div>
          <div>
            <label htmlFor={`opportunitySkillLevel-${index}`} className="sr-only">
              Requirement level for skill {index + 1}
            </label>
            <Select id={`opportunitySkillLevel-${index}`} name="opportunitySkillLevel" defaultValue={row.level}>
              {Object.entries(REQUIREMENT_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
          <button
            type="button"
            onClick={() => setRows(rows.filter((_, position) => position !== index))}
            className="inline-flex h-[38px] items-center justify-center rounded-[8px] border border-line-strong px-3 text-[13px] text-muted transition-colors hover:border-bad/40 hover:text-bad"
          >
            Remove
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={() => setRows([...rows, { name: "", level: "preferred" }])}
        className="inline-flex h-9 w-fit items-center gap-1.5 rounded-full border border-line-strong bg-white px-4 text-[13px] text-ink transition-colors hover:bg-shell"
      >
        <Plus className="size-3.5" aria-hidden="true" />
        Add skill
      </button>
    </div>
  );
}

export type QuestionDraft = {
  type: string;
  prompt: string;
  helpText: string;
  required: boolean;
  options: string;
  maxLength: string;
};

const EMPTY_QUESTION: QuestionDraft = {
  type: "long_text",
  prompt: "",
  helpText: "",
  required: true,
  options: "",
  maxLength: "2000",
};

const QUESTION_TYPES = Object.entries(QUESTION_TYPE_LABELS).filter(
  ([value]) => value !== "paper_response" && value !== "video_response",
);

function QuestionRow({ index, draft, onRemove }: { index: number; draft: QuestionDraft; onRemove: () => void }) {
  const [type, setType] = useState(draft.type);

  return (
    <fieldset className="rounded-[10px] border border-line bg-shell/50 p-4">
      <legend className="px-1 text-[12px] font-medium uppercase tracking-[0.1em] text-subtle">
        Question {index + 1}
      </legend>

      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`questionType-${index}`} className="text-[13px] font-medium text-ink">
            Answer type
          </label>
          <Select id={`questionType-${index}`} name="questionType" value={type} onChange={(event) => setType(event.target.value)}>
            {QUESTION_TYPES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={`questionRequired-${index}`} className="text-[13px] font-medium text-ink">
            Required
          </label>
          <Select id={`questionRequired-${index}`} name="questionRequired" defaultValue={draft.required ? "true" : "false"}>
            <option value="true">Required</option>
            <option value="false">Optional</option>
          </Select>
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-1.5">
        <label htmlFor={`questionPrompt-${index}`} className="text-[13px] font-medium text-ink">
          Question
        </label>
        <Textarea
          id={`questionPrompt-${index}`}
          name="questionPrompt"
          rows={2}
          defaultValue={draft.prompt}
          placeholder="What interests you about clinical outcomes research?"
        />
      </div>

      <div className="mt-3 flex flex-col gap-1.5">
        <label htmlFor={`questionHelp-${index}`} className="text-[13px] font-medium text-ink">
          Guidance for students
        </label>
        <Input id={`questionHelp-${index}`} name="questionHelp" defaultValue={draft.helpText} placeholder="Optional." />
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`questionOptions-${index}`} className="text-[13px] font-medium text-ink">
            Choices
          </label>
          <Input
            id={`questionOptions-${index}`}
            name="questionOptions"
            defaultValue={draft.options}
            placeholder="Separate with commas"
            disabled={type !== "multiple_choice"}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`questionMaxLength-${index}`} className="text-[13px] font-medium text-ink">
            Character limit
          </label>
          <Input
            id={`questionMaxLength-${index}`}
            name="questionMaxLength"
            type="number"
            min={50}
            max={8000}
            defaultValue={draft.maxLength}
            disabled={!["long_text", "short_text"].includes(type)}
          />
        </div>
      </div>

      <button
        type="button"
        onClick={onRemove}
        className="mt-3 inline-flex h-9 items-center rounded-full border border-line-strong px-4 text-[13px] text-muted transition-colors hover:border-bad/40 hover:text-bad"
      >
        Remove this question
      </button>
    </fieldset>
  );
}

export function QuestionRows({ initial }: { initial: QuestionDraft[] }) {
  const [rows, setRows] = useState<QuestionDraft[]>(initial);

  return (
    <div className="flex flex-col gap-4">
      {rows.length === 0 ? (
        <div className="rounded-[10px] border border-dashed border-line-strong bg-shell/60 px-4 py-6 text-center">
          <p className="text-[14px] text-ink">No questions added.</p>
          <p className="mt-1 text-[13px] leading-6 text-muted">
            Students will send their profile only. A project-specific question is the single most effective way to
            reduce generic applications.
          </p>
        </div>
      ) : null}

      {rows.map((row, index) => (
        <QuestionRow
          key={index}
          index={index}
          draft={row}
          onRemove={() => setRows(rows.filter((_, position) => position !== index))}
        />
      ))}

      <button
        type="button"
        onClick={() => setRows([...rows, { ...EMPTY_QUESTION }])}
        className="inline-flex h-9 w-fit items-center gap-1.5 rounded-full border border-line-strong bg-white px-4 text-[13px] text-ink transition-colors hover:bg-shell"
      >
        <Plus className="size-3.5" aria-hidden="true" />
        Add question
      </button>
    </div>
  );
}
