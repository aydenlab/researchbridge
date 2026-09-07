"use client";

import { useId, useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import { Input, Select } from "@/components/ui/field";
import { cn } from "@/components/ui/cn";

export function TokenField({
  name,
  label,
  hint,
  placeholder,
  suggestions = [],
  initial = [],
  max = 40,
}: {
  name: string;
  label: string;
  hint?: string;
  placeholder?: string;
  suggestions?: string[];
  initial?: string[];
  max?: number;
}) {
  const [values, setValues] = useState<string[]>(initial);
  const [draft, setDraft] = useState("");
  const listId = useId();
  const inputId = `${name}-input`;

  const available = useMemo(
    () => suggestions.filter((item) => !values.some((value) => value.toLowerCase() === item.toLowerCase())),
    [suggestions, values],
  );

  function add(raw: string) {
    const value = raw.trim();
    if (!value) return;
    if (values.length >= max) return;
    if (values.some((existing) => existing.toLowerCase() === value.toLowerCase())) return;
    setValues([...values, value]);
    setDraft("");
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-[13px] font-medium text-ink">
        {label}
        <span className="ml-1.5 text-[11.5px] font-normal text-subtle">Optional</span>
      </label>
      {hint ? <p className="text-[12.5px] leading-5 text-muted">{hint}</p> : null}

      {values.map((value) => (
        <input key={value} type="hidden" name={name} value={value} />
      ))}

      <div className="flex gap-2">
        <Input
          id={inputId}
          list={listId}
          value={draft}
          placeholder={placeholder}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === ",") {
              event.preventDefault();
              add(draft);
            }
          }}
        />
        <button
          type="button"
          onClick={() => add(draft)}
          className="inline-flex h-[38px] shrink-0 items-center gap-1 rounded-[8px] border border-line-strong px-3 text-[13px] text-ink transition-colors hover:bg-shell"
        >
          <Plus className="size-3.5" aria-hidden="true" />
          Add
        </button>
      </div>

      {available.length > 0 ? (
        <datalist id={listId}>
          {available.slice(0, 200).map((item) => (
            <option key={item} value={item} />
          ))}
        </datalist>
      ) : null}

      {values.length > 0 ? (
        <ul className="mt-1.5 flex flex-wrap gap-1.5">
          {values.map((value) => (
            <li key={value}>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-shell py-1 pl-3 pr-1.5 text-[12.5px] text-ink">
                {value}
                <button
                  type="button"
                  onClick={() => setValues(values.filter((item) => item !== value))}
                  className="inline-flex size-4 items-center justify-center rounded-full text-muted transition-colors hover:bg-line hover:text-ink"
                >
                  <X className="size-3" aria-hidden="true" />
                  <span className="sr-only">Remove {value}</span>
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-[12.5px] text-subtle">Nothing added yet.</p>
      )}
    </div>
  );
}

export type SkillRow = { name: string; proficiency: string | null; context: string | null };

const PROFICIENCIES = [
  { value: "", label: "Level not stated" },
  { value: "exposure", label: "Some exposure" },
  { value: "working", label: "Working knowledge" },
  { value: "proficient", label: "Proficient" },
  { value: "advanced", label: "Advanced" },
];

export function SkillRows({ initial, suggestions }: { initial: SkillRow[]; suggestions: string[] }) {
  const [rows, setRows] = useState<SkillRow[]>(
    initial.length > 0 ? initial : [{ name: "", proficiency: "", context: "" }],
  );
  const listId = useId();

  return (
    <div className="flex flex-col gap-3">
      <datalist id={listId}>
        {suggestions.map((item) => (
          <option key={item} value={item} />
        ))}
      </datalist>

      {rows.map((row, index) => (
        <div key={index} className="rounded-[10px] border border-line bg-shell/50 p-3">
          <div className="grid gap-2.5 sm:grid-cols-[1.2fr_1fr_auto]">
            <div>
              <label htmlFor={`skillName-${index}`} className="sr-only">
                Skill {index + 1}
              </label>
              <Input
                id={`skillName-${index}`}
                name="skillName"
                list={listId}
                defaultValue={row.name}
                placeholder="Python, cell culture, systematic reviews"
              />
            </div>
            <div>
              <label htmlFor={`skillProficiency-${index}`} className="sr-only">
                Level for skill {index + 1}
              </label>
              <Select id={`skillProficiency-${index}`} name="skillProficiency" defaultValue={row.proficiency ?? ""}>
                {PROFICIENCIES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
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
          <div className="mt-2.5">
            <label htmlFor={`skillContext-${index}`} className="sr-only">
              Context for skill {index + 1}
            </label>
            <Input
              id={`skillContext-${index}`}
              name="skillContext"
              defaultValue={row.context ?? ""}
              placeholder="Where you used it, in a sentence. Optional."
            />
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={() => setRows([...rows, { name: "", proficiency: "", context: "" }])}
        className="inline-flex h-9 w-fit items-center gap-1.5 rounded-full border border-line-strong px-4 text-[13px] text-ink transition-colors hover:bg-shell"
      >
        <Plus className="size-3.5" aria-hidden="true" />
        Add another skill
      </button>
    </div>
  );
}

export type ExperienceRow = {
  organization: string;
  supervisor: string | null;
  title: string | null;
  startDate: string | null;
  endDate: string | null;
  description: string | null;
  techniques: string[];
  outputs: string[];
};

const EMPTY_EXPERIENCE: ExperienceRow = {
  organization: "",
  supervisor: "",
  title: "",
  startDate: "",
  endDate: "",
  description: "",
  techniques: [],
  outputs: [],
};

export function ExperienceRows({ initial }: { initial: ExperienceRow[] }) {
  const [rows, setRows] = useState<ExperienceRow[]>(initial);

  return (
    <div className="flex flex-col gap-4">
      {rows.length === 0 ? (
        <div className="rounded-[10px] border border-dashed border-line-strong bg-shell/60 px-4 py-6 text-center">
          <p className="text-[14px] text-ink">No research experience added.</p>
          <p className="mt-1 text-[13px] leading-6 text-muted">
            That is completely fine. Many positions are written for students with none, and researchers set their own
            requirements.
          </p>
        </div>
      ) : null}

      {rows.map((row, index) => (
        <fieldset key={index} className="rounded-[10px] border border-line bg-shell/50 p-4">
          <legend className="px-1 text-[12px] font-medium text-subtle">
            Experience {index + 1}
          </legend>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`expOrganization-${index}`} className="text-[13px] font-medium text-ink">
                Organization or lab
              </label>
              <Input
                id={`expOrganization-${index}`}
                name="expOrganization"
                defaultValue={row.organization}
                placeholder="Mobility and Aging Lab"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`expTitle-${index}`} className="text-[13px] font-medium text-ink">
                Your role
              </label>
              <Input id={`expTitle-${index}`} name="expTitle" defaultValue={row.title ?? ""} placeholder="Research assistant" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`expSupervisor-${index}`} className="text-[13px] font-medium text-ink">
                Supervisor
              </label>
              <Input id={`expSupervisor-${index}`} name="expSupervisor" defaultValue={row.supervisor ?? ""} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor={`expStart-${index}`} className="text-[13px] font-medium text-ink">
                  Started
                </label>
                <Input id={`expStart-${index}`} name="expStart" type="date" defaultValue={row.startDate ?? ""} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor={`expEnd-${index}`} className="text-[13px] font-medium text-ink">
                  Ended
                </label>
                <Input id={`expEnd-${index}`} name="expEnd" type="date" defaultValue={row.endDate ?? ""} />
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-col gap-1.5">
            <label htmlFor={`expDescription-${index}`} className="text-[13px] font-medium text-ink">
              What did you actually do?
            </label>
            <textarea
              id={`expDescription-${index}`}
              name="expDescription"
              defaultValue={row.description ?? ""}
              rows={4}
              className="w-full rounded-[8px] border border-line-strong bg-white px-3 py-2 text-[14px] leading-6 text-ink placeholder:text-subtle hover:border-ink/25 focus:border-forest"
              placeholder="Specific tasks are more useful than a job title."
            />
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`expTechniques-${index}`} className="text-[13px] font-medium text-ink">
                Techniques and skills used
              </label>
              <Input
                id={`expTechniques-${index}`}
                name="expTechniques"
                defaultValue={row.techniques.join(", ")}
                placeholder="Separate with commas"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`expOutputs-${index}`} className="text-[13px] font-medium text-ink">
                Outputs
              </label>
              <Input
                id={`expOutputs-${index}`}
                name="expOutputs"
                defaultValue={row.outputs.join(", ")}
                placeholder="Poster, publication, report, code, no formal output"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={() => setRows(rows.filter((_, position) => position !== index))}
            className="mt-3 inline-flex h-9 items-center rounded-full border border-line-strong px-4 text-[13px] text-muted transition-colors hover:border-bad/40 hover:text-bad"
          >
            Remove this experience
          </button>
        </fieldset>
      ))}

      <button
        type="button"
        onClick={() => setRows([...rows, { ...EMPTY_EXPERIENCE }])}
        className="inline-flex h-9 w-fit items-center gap-1.5 rounded-full border border-line-strong px-4 text-[13px] text-ink transition-colors hover:bg-shell"
      >
        <Plus className="size-3.5" aria-hidden="true" />
        Add research experience
      </button>
    </div>
  );
}

export function CheckboxGrid({
  name,
  options,
  initial = [],
  columns = 3,
}: {
  name: string;
  options: { value: string; label: string }[];
  initial?: string[];
  columns?: number;
}) {
  const selected = new Set(initial);
  return (
    <div
      className={cn(
        "grid gap-2",
        columns === 2 ? "sm:grid-cols-2" : columns === 4 ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-2 lg:grid-cols-3",
      )}
    >
      {options.map((option) => (
        <label
          key={option.value}
          className="flex cursor-pointer items-start gap-2 rounded-[8px] border border-line bg-white px-3 py-2 text-[13.5px] text-ink transition-colors hover:border-forest/40 has-[:checked]:border-forest has-[:checked]:bg-moss/50"
        >
          <input
            type="checkbox"
            name={name}
            value={option.value}
            defaultChecked={selected.has(option.value)}
            className="mt-0.5 size-4 shrink-0 accent-[#1d4436]"
          />
          <span>{option.label}</span>
        </label>
      ))}
    </div>
  );
}

/**
 * A multi-select with a select-all control. Separate from CheckboxGrid because
 * it has to own its state to drive the toggle, and because "select all" is only
 * ever meaningful on a short, closed list of options.
 */
export function MultiSelectGrid({
  name,
  legend,
  hint,
  options,
  initial = [],
  columns = 2,
  selectAllLabel = "Select all",
  error,
}: {
  name: string;
  legend: string;
  hint?: string;
  options: { value: string; label: string; description?: string }[];
  initial?: string[];
  columns?: number;
  selectAllLabel?: string;
  error?: string;
}) {
  const [selected, setSelected] = useState<string[]>(() => initial.filter((value) => options.some((o) => o.value === value)));
  const allSelected = selected.length === options.length && options.length > 0;

  function toggle(value: string) {
    setSelected((current) => (current.includes(value) ? current.filter((item) => item !== value) : [...current, value]));
  }

  return (
    <fieldset>
      <legend className="mb-1 text-[13px] font-medium text-ink">{legend}</legend>
      {hint ? <p className="mb-2 text-[12.5px] leading-5 text-muted">{hint}</p> : null}
      {error ? (
        <p role="alert" className="mb-2 text-[12.5px] text-bad">
          {error}
        </p>
      ) : null}

      {selected.map((value) => (
        <input key={value} type="hidden" name={name} value={value} />
      ))}

      <label className="mb-2 flex w-fit cursor-pointer items-center gap-2 text-[12.5px] text-muted">
        <input
          type="checkbox"
          checked={allSelected}
          onChange={() => setSelected(allSelected ? [] : options.map((option) => option.value))}
          className="size-3.5 accent-[#1d4436]"
        />
        {selectAllLabel}
      </label>

      <div
        className={cn(
          "grid gap-2",
          columns === 1 ? "" : columns === 3 ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2",
        )}
      >
        {options.map((option) => (
          <label
            key={option.value}
            className="flex cursor-pointer items-start gap-2 rounded-[8px] border border-line bg-white px-3 py-2 text-[13.5px] text-ink transition-colors hover:border-forest/40 has-[:checked]:border-forest has-[:checked]:bg-moss/50"
          >
            <input
              type="checkbox"
              checked={selected.includes(option.value)}
              onChange={() => toggle(option.value)}
              className="mt-0.5 size-4 shrink-0 accent-[#1d4436]"
            />
            <span className="min-w-0">
              <span className="block">{option.label}</span>
              {option.description ? (
                <span className="mt-0.5 block text-[12px] leading-5 text-muted">{option.description}</span>
              ) : null}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
