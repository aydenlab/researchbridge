"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/field";
import { cn } from "@/components/ui/cn";
import {
  DISCIPLINES,
  OTHER,
  OTHER_DISCIPLINE_SLUG,
  areasForDisciplines,
  disciplinesForAreaSlugs,
} from "@/lib/disciplines";
import { slugify } from "@/lib/format";

export type PickerField = { id: string; name: string; slug: string };

/** What a single-choice picker submits when Other is the chosen area. */
export const OTHER_AREA_VALUE = "other";

const card =
  "flex cursor-pointer items-start gap-2 rounded-[8px] border border-line bg-white px-3 py-2 text-[13.5px] text-ink transition-colors hover:border-forest/40 has-[:checked]:border-forest has-[:checked]:bg-moss/50";
const grid = "grid gap-2 sm:grid-cols-2 lg:grid-cols-3";

function Legend({ label, required, hint }: { label: string; required?: boolean; hint?: string }) {
  return (
    <>
      <legend className="mb-1 text-[13px] font-medium text-ink">
        {label}
        {required ? <span className="ml-1 text-clay">*</span> : <span className="ml-1.5 text-[11.5px] font-normal text-subtle">Optional</span>}
      </legend>
      {hint ? <p className="mb-2 text-[12.5px] leading-5 text-muted">{hint}</p> : <div className="mb-2" />}
    </>
  );
}

function ErrorText({ children }: { children?: string }) {
  if (!children) return null;
  return (
    <p role="alert" className="mt-2 text-[12.5px] text-bad">
      {children}
    </p>
  );
}

/**
 * Discipline first, then research area. Both are multi-select (or area is a
 * single radio with `single`), and the areas offered are the union of every
 * chosen discipline's areas with duplicates removed.
 *
 * Submits `disciplines` (slugs), `researchFieldIds` (or `inputName`), and, when
 * `withOther` is on, `disciplineOther`, `researchAreaOther`, and
 * `researchAreaOtherSelected` so the server can insist on the free text.
 *
 * With `single`, Other is a member of the radio group instead: it submits
 * OTHER_AREA_VALUE under `inputName` and its text under `otherName`, the shape
 * the one-page posting form's schema expects. `otherDiscipline` can switch off
 * the standalone Other discipline where its text would not be saved.
 *
 * A selected field that is not in the mapping (older taxonomy, or one a person
 * typed in) stays visible and ticked under its own heading, so saving the form
 * never silently drops it. With no saved disciplines, the ones the selected
 * areas belong to start ticked.
 */
export function ResearchAreaPicker({
  fields,
  initialDisciplines = [],
  initialAreaIds = [],
  initialDisciplineOther = "",
  initialAreaOther = "",
  withOther = true,
  otherDiscipline = withOther,
  otherName = "researchAreaOther",
  otherPlaceholder,
  single = false,
  required = true,
  inputName = "researchFieldIds",
  areaLabel = "Research area",
  errors,
}: {
  fields: PickerField[];
  initialDisciplines?: string[];
  initialAreaIds?: string[];
  initialDisciplineOther?: string;
  initialAreaOther?: string;
  withOther?: boolean;
  otherDiscipline?: boolean;
  otherName?: string;
  otherPlaceholder?: string;
  single?: boolean;
  required?: boolean;
  inputName?: string;
  areaLabel?: string;
  errors?: Record<string, string[] | undefined>;
}) {
  const bySlug = useMemo(() => new Map(fields.map((field) => [field.slug, field])), [fields]);
  const mappedSlugs = useMemo(
    () => new Set(DISCIPLINES.flatMap((discipline) => discipline.areas.map((area) => slugify(area)))),
    [],
  );

  const [disciplines, setDisciplines] = useState<string[]>(() =>
    initialDisciplines.length > 0
      ? initialDisciplines
      : disciplinesForAreaSlugs(fields.filter((field) => initialAreaIds.includes(field.id)).map((field) => field.slug)),
  );
  const [areaIds, setAreaIds] = useState<string[]>(initialAreaIds);
  const [areaOtherChecked, setAreaOtherChecked] = useState(
    withOther && (single ? initialAreaIds.includes(OTHER_AREA_VALUE) : initialAreaOther.trim().length > 0),
  );

  const disciplineOptions = [
    ...DISCIPLINES.map((discipline) => ({ value: discipline.slug, label: discipline.name })),
    ...(otherDiscipline ? [{ value: OTHER_DISCIPLINE_SLUG, label: OTHER }] : []),
  ];

  const offered = areasForDisciplines(disciplines)
    .filter((name) => withOther || name !== OTHER)
    .map((name) => (name === OTHER ? { id: null, name } : { id: bySlug.get(slugify(name))?.id ?? null, name }))
    .filter((area) => area.name === OTHER || area.id !== null) as { id: string | null; name: string }[];

  // Selections the mapping cannot show, kept so a resave does not lose them.
  const extras = fields.filter(
    (field) =>
      initialAreaIds.includes(field.id) &&
      !mappedSlugs.has(field.slug) &&
      field.name.trim().toLowerCase() !== initialAreaOther.trim().toLowerCase(),
  );

  const otherDisciplineChosen = disciplines.includes(OTHER_DISCIPLINE_SLUG);
  const showAreaOther = withOther && areaOtherChecked && offered.some((area) => area.name === OTHER);

  function toggleDiscipline(slug: string) {
    setDisciplines((current) => (current.includes(slug) ? current.filter((item) => item !== slug) : [...current, slug]));
  }

  function toggleArea(id: string) {
    if (single) {
      setAreaOtherChecked(false);
      return setAreaIds([id]);
    }
    setAreaIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  return (
    <div className="flex flex-col gap-5">
      <fieldset>
        <Legend
          label="Discipline"
          required={required}
          hint="Choose every discipline that fits. The research areas below update to match."
        />
        <div className={grid}>
          {disciplineOptions.map((option) => (
            <label key={option.value} className={card}>
              <input
                type="checkbox"
                name="disciplines"
                value={option.value}
                checked={disciplines.includes(option.value)}
                onChange={() => toggleDiscipline(option.value)}
                className="mt-0.5 size-4 shrink-0 accent-[#1d4436]"
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
        <ErrorText>{errors?.disciplines?.[0]}</ErrorText>

        {otherDiscipline && otherDisciplineChosen ? (
          <div className="mt-3 flex flex-col gap-1.5 sm:max-w-[420px]">
            <label htmlFor="disciplineOther" className="text-[13px] font-medium text-ink">
              Please specify your discipline <span className="text-clay">*</span>
            </label>
            <Input
              id="disciplineOther"
              name="disciplineOther"
              defaultValue={initialDisciplineOther}
              maxLength={120}
              required
            />
            <ErrorText>{errors?.disciplineOther?.[0]}</ErrorText>
          </div>
        ) : null}
      </fieldset>

      <fieldset>
        <Legend
          label={areaLabel}
          required={required}
          hint={single ? "Choose the one that fits best." : "Choose as many as apply."}
        />
        {offered.length === 0 && extras.length === 0 ? (
          <p className="rounded-[8px] border border-dashed border-line-strong px-3 py-3 text-[13px] text-muted">
            Choose a discipline above to see its research areas.
          </p>
        ) : null}

        {offered.length > 0 ? (
          <div className={grid}>
            {offered.map((area) =>
              area.id === null ? (
                <label key={OTHER} className={card}>
                  {single ? (
                    <input
                      type="radio"
                      name={inputName}
                      value={OTHER_AREA_VALUE}
                      checked={areaOtherChecked}
                      onChange={() => {
                        setAreaIds([]);
                        setAreaOtherChecked(true);
                      }}
                      required={required}
                      className="mt-0.5 size-4 shrink-0 accent-[#1d4436]"
                    />
                  ) : (
                    <input
                      type="checkbox"
                      name="researchAreaOtherSelected"
                      value="on"
                      checked={areaOtherChecked}
                      onChange={() => setAreaOtherChecked((value) => !value)}
                      className="mt-0.5 size-4 shrink-0 accent-[#1d4436]"
                    />
                  )}
                  <span>{OTHER}</span>
                </label>
              ) : (
                <label key={area.id} className={card}>
                  <input
                    type={single ? "radio" : "checkbox"}
                    name={inputName}
                    value={area.id}
                    checked={areaIds.includes(area.id)}
                    onChange={() => toggleArea(area.id as string)}
                    required={single && required}
                    className="mt-0.5 size-4 shrink-0 accent-[#1d4436]"
                  />
                  <span>{area.name}</span>
                </label>
              ),
            )}
          </div>
        ) : null}

        {extras.length > 0 ? (
          <div className={cn(offered.length > 0 && "mt-4")}>
            <p className="mb-2 text-[12.5px] text-subtle">Already on this profile</p>
            <div className={grid}>
              {extras.map((field) => (
                <label key={field.id} className={card}>
                  <input
                    type={single ? "radio" : "checkbox"}
                    name={inputName}
                    value={field.id}
                    checked={areaIds.includes(field.id)}
                    onChange={() => toggleArea(field.id)}
                    className="mt-0.5 size-4 shrink-0 accent-[#1d4436]"
                  />
                  <span>{field.name}</span>
                </label>
              ))}
            </div>
          </div>
        ) : null}

        <ErrorText>{errors?.[inputName]?.[0]}</ErrorText>

        {showAreaOther ? (
          <div className="mt-3 flex flex-col gap-1.5 sm:max-w-[420px]">
            <label htmlFor={otherName} className="text-[13px] font-medium text-ink">
              Please specify your research area <span className="text-clay">*</span>
            </label>
            <Input
              id={otherName}
              name={otherName}
              defaultValue={initialAreaOther}
              placeholder={otherPlaceholder}
              maxLength={160}
              required
            />
            <ErrorText>{errors?.[otherName]?.[0]}</ErrorText>
          </div>
        ) : null}
      </fieldset>
    </div>
  );
}
