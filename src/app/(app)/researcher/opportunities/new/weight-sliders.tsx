"use client";

import { useState } from "react";
import type { FormValues } from "@/lib/action-utils";
import { DEFAULT_WEIGHT, readWeight } from "@/lib/criteria/from-weights";

const WEIGHT_MAX = 100;

const WEIGHTS = [
  {
    name: "weightGpa",
    label: "GPA and academic standing",
    hint: "How much a student's grades count towards the overall picture.",
  },
  {
    name: "weightExtracurriculars",
    label: "Extracurricular involvement",
    hint: "Clubs, volunteering, teaching, and other commitments outside coursework.",
  },
  {
    name: "weightPriorResearch",
    label: "Prior research experience",
    hint: "Previous lab, field, or project work. Set this low to attract beginners.",
  },
  {
    name: "weightResearchInterests",
    label: "Research interests",
    hint: "How closely a student's stated interests line up with this project.",
  },
  {
    name: "weightSkills",
    label: "Skills",
    hint: "The specific skills you selected above.",
  },
] as const;

const INITIAL = WEIGHTS.map(() => DEFAULT_WEIGHT);

/** Each weight's share of the total, as whole percentages that add up to 100. */
function shares(values: number[]): number[] {
  const total = values.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return values.map(() => 0);

  const exact = values.map((value) => (value * 100) / total);
  const result = exact.map(Math.floor);
  let outstanding = 100 - result.reduce((sum, value) => sum + value, 0);

  const byRemainder = exact
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder);

  for (const { index } of byRemainder) {
    if (outstanding <= 0) break;
    result[index] += 1;
    outstanding -= 1;
  }

  return result;
}

export function WeightSliders({ initial }: { initial?: FormValues }) {
  // A refused submission hands every slider back, so the balance a researcher
  // set does not quietly reset to the middle along with the rest of the form.
  const [weights, setWeights] = useState<number[]>(() =>
    WEIGHTS.map((weight, index) => {
      const submitted = initial?.[weight.name]?.[0];
      return submitted === undefined ? INITIAL[index] : readWeight(submitted);
    }),
  );
  const total = weights.reduce((sum, value) => sum + value, 0);
  const balance = shares(weights);

  function setWeight(index: number, next: number) {
    const value = Math.max(0, Math.min(WEIGHT_MAX, Math.round(next)));
    setWeights(weights.map((current, position) => (position === index ? value : current)));
  }

  return (
    <div className="flex flex-col gap-4">
      {WEIGHTS.map((weight, index) => (
        <div key={weight.name} className="rounded-[10px] border border-line bg-shell/50 p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <label htmlFor={weight.name} className="text-[13px] font-medium text-ink">
              {weight.label}
            </label>
            <output htmlFor={weight.name} className="font-mono text-[13px] text-forest">
              {weights[index]}
            </output>
          </div>
          <p className="mt-1 text-[12px] leading-5 text-muted">{weight.hint}</p>
          <input
            id={weight.name}
            name={weight.name}
            type="range"
            min={0}
            max={WEIGHT_MAX}
            step={1}
            value={weights[index]}
            onChange={(event) => setWeight(index, Number(event.target.value))}
            className="mt-3 w-full accent-[#1d4436]"
          />
        </div>
      ))}

      <div className="rounded-[10px] border border-line bg-white p-4">
        <h3 className="text-[13px] font-medium text-ink">Relative balance</h3>
        <p className="mt-1 text-[12px] leading-5 text-muted">
          Each slider stands on its own. What matters when applications are reviewed is how they compare, so this is what
          your settings work out to.
        </p>

        {total === 0 ? (
          <p className="mt-3 rounded-[8px] border border-[#e6d7ae] bg-gold-soft px-3 py-2.5 text-[12.5px] leading-5 text-warn">
            Every weight is at zero, so nothing would be emphasized. Raise at least one.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {WEIGHTS.map((weight, index) => (
              <li key={weight.name} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1">
                <span className="text-[13px] text-ink">{weight.label}</span>
                <span className="font-mono text-[13px] text-forest">{balance[index]}%</span>
                <span className="col-span-2 h-1.5 overflow-hidden rounded-full bg-cream">
                  <span
                    className="block h-full rounded-full bg-forest transition-[width]"
                    style={{ width: `${balance[index]}%` }}
                  />
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
