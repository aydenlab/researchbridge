"use client";

import { useState } from "react";
import { cn } from "@/components/ui/cn";
import { Input } from "@/components/ui/field";

export type Option = { value: string; label: string; description?: string };

/**
 * The escape hatch for a group whose fixed list will not cover every project.
 * Selecting the card reveals a text box, and what is typed there is submitted
 * under `name` for the action to turn into a real value.
 */
export type OtherOption = {
  name: string;
  label?: string;
  description?: string;
  placeholder?: string;
  /** What a refused submission typed here, so a validation message does not erase it. */
  initial?: string;
  maxLength?: number;
};

/** The value a radio group submits when its "Other" card is the one chosen. */
export const OTHER_VALUE = "other";

const cardClass =
  "flex cursor-pointer items-start gap-2 rounded-[8px] border border-line bg-white px-3 py-2 text-[13.5px] text-ink transition-colors hover:border-forest/40 has-[:checked]:border-forest has-[:checked]:bg-moss/50";

/**
 * Click-to-select cards. Mirrors CheckboxGrid from components/app/inputs, but
 * handles radios too so single-choice groups read the same as multi-choice ones.
 */
export function OptionGrid({
  type,
  name,
  options,
  initial = [],
  columns = 3,
  required,
  selectAllLabel,
  other,
}: {
  type: "checkbox" | "radio";
  name: string;
  options: Option[];
  initial?: string[];
  columns?: 2 | 3 | 4;
  required?: boolean;
  /** Only meaningful for checkbox groups. Omit for a plain grid. */
  selectAllLabel?: string;
  /** Adds an "Other" card with a text box behind it. Omit for a closed list. */
  other?: OtherOption;
}) {
  const [selected, setSelected] = useState<string[]>(() => initial.filter((value) => options.some((o) => o.value === value)));
  /**
   * A radio group must submit exactly one value, so its "Other" is a member of
   * the group and arrives as OTHER_VALUE. A checkbox group's "Other" is additive
   * instead: it submits nothing of its own, and only the text box it opens is
   * posted, which keeps the group's own values a closed enum on the server.
   */
  const [otherOn, setOtherOn] = useState(() =>
    type === "radio" ? initial.includes(OTHER_VALUE) : Boolean(other?.initial),
  );
  const allSelected = selected.length === options.length && options.length > 0;

  function toggle(value: string) {
    setSelected((current) => (current.includes(value) ? current.filter((item) => item !== value) : [...current, value]));
  }

  return (
    <>
    {type === "checkbox" && selectAllLabel ? (
      <label className="mb-2 flex w-fit cursor-pointer items-center gap-2 text-[12.5px] text-muted">
        <input
          type="checkbox"
          checked={allSelected}
          onChange={() => setSelected(allSelected ? [] : options.map((option) => option.value))}
          className="size-3.5 accent-[#1d4436]"
        />
        {selectAllLabel}
      </label>
    ) : null}
    <div
      className={cn(
        "grid gap-2",
        columns === 2 ? "sm:grid-cols-2" : columns === 4 ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-2 lg:grid-cols-3",
      )}
    >
      {options.map((option) => (
        <label key={option.value} className={cardClass}>
          <input
            type={type}
            name={name}
            value={option.value}
            {...(type === "checkbox"
              ? { checked: selected.includes(option.value), onChange: () => toggle(option.value) }
              : { defaultChecked: initial.includes(option.value), onChange: () => setOtherOn(false) })}
            required={required}
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

      {other ? (
        <label className={cardClass}>
          {type === "radio" ? (
            <input
              type="radio"
              name={name}
              value={OTHER_VALUE}
              defaultChecked={initial.includes(OTHER_VALUE)}
              onChange={() => setOtherOn(true)}
              required={required}
              className="mt-0.5 size-4 shrink-0 accent-[#1d4436]"
            />
          ) : (
            <input
              type="checkbox"
              checked={otherOn}
              onChange={() => setOtherOn(!otherOn)}
              className="mt-0.5 size-4 shrink-0 accent-[#1d4436]"
            />
          )}
          <span className="min-w-0">
            <span className="block">{other.label ?? "Other"}</span>
            {other.description ? (
              <span className="mt-0.5 block text-[12px] leading-5 text-muted">{other.description}</span>
            ) : null}
          </span>
        </label>
      ) : null}
    </div>

    {other && otherOn ? (
      <Input
        className="mt-2 sm:max-w-[420px]"
        name={other.name}
        defaultValue={other.initial}
        placeholder={other.placeholder}
        maxLength={other.maxLength ?? 160}
        aria-label={other.label ?? "Other"}
        autoFocus
        required
      />
    ) : null}
    </>
  );
}
