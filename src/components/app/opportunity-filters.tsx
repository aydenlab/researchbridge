"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { cn } from "@/components/ui/cn";

export type FilterOption = { value: string; label: string };

export type FilterGroup = {
  key: string;
  label: string;
  options: FilterOption[];
};

export function OpportunityFilters({
  groups,
  total,
  activeCount,
}: {
  groups: FilterGroup[];
  total: number;
  activeCount: number;
}) {
  const params = useSearchParams();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const current = (key: string) => params.getAll(key);

  function apply(next: URLSearchParams) {
    next.delete("page");
    const query = next.toString();
    router.push(query ? `/opportunities?${query}` : "/opportunities");
  }

  function toggle(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    const existing = next.getAll(key);
    next.delete(key);
    for (const item of existing) {
      if (item !== value) next.append(key, item);
    }
    if (!existing.includes(value)) next.append(key, value);
    apply(next);
  }

  function setSingle(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    next.delete(key);
    if (value) next.set(key, value);
    apply(next);
  }

  function clearAll() {
    router.push("/opportunities");
  }

  return (
    <div className="lg:sticky lg:top-[68px]">
      <form
        action="/opportunities"
        method="get"
        className="flex gap-2"
        onSubmit={() => setOpen(false)}
      >
        {[...params.entries()]
          .filter(([key]) => key !== "q" && key !== "page")
          .map(([key, value], index) => (
            <input key={`${key}-${value}-${index}`} type="hidden" name={key} value={value} />
          ))}
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" aria-hidden="true" />
          <label htmlFor="opportunity-search" className="sr-only">
            Search opportunities
          </label>
          <Input
            id="opportunity-search"
            name="q"
            type="search"
            defaultValue={params.get("q") ?? ""}
            placeholder="Project, researcher, lab, or field"
            className="pl-9"
          />
        </div>
        <Button type="submit" size="md">
          Search
        </Button>
      </form>

      <div className="mt-3 flex items-center justify-between gap-3 lg:hidden">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="inline-flex h-9 items-center gap-2 rounded-full border border-line-strong bg-white px-4 text-[13px] text-ink"
        >
          <SlidersHorizontal className="size-3.5" aria-hidden="true" />
          Filters
          {activeCount > 0 ? (
            <span className="inline-flex size-5 items-center justify-center rounded-full bg-forest text-[11px] text-white">
              {activeCount}
            </span>
          ) : null}
        </button>
        <p className="text-[13px] text-muted">{total} shown</p>
      </div>

      <div className={cn("mt-4 flex-col gap-6", open ? "flex" : "hidden lg:flex")}>
        <div>
          <label htmlFor="sort" className="mb-1.5 block text-[12px] font-medium uppercase tracking-[0.1em] text-subtle">
            Sort by
          </label>
          <Select id="sort" value={params.get("sort") ?? "recent"} onChange={(event) => setSingle("sort", event.target.value)}>
            <option value="recent">Recently posted</option>
            <option value="deadline">Application deadline</option>
            <option value="hours">Fewest hours per week</option>
          </Select>
        </div>

        <div>
          <label htmlFor="maxHours" className="mb-1.5 block text-[12px] font-medium uppercase tracking-[0.1em] text-subtle">
            Maximum hours per week
          </label>
          <Select id="maxHours" value={params.get("maxHours") ?? ""} onChange={(event) => setSingle("maxHours", event.target.value)}>
            <option value="">Any commitment</option>
            <option value="5">Up to 5 hours</option>
            <option value="8">Up to 8 hours</option>
            <option value="12">Up to 12 hours</option>
            <option value="20">Up to 20 hours</option>
          </Select>
        </div>

        {groups.map((group) => (
          <fieldset key={group.key}>
            <legend className="mb-2 text-[12px] font-medium uppercase tracking-[0.1em] text-subtle">{group.label}</legend>
            <div className="flex flex-col gap-1.5">
              {group.options.map((option) => {
                const checked = current(group.key).includes(option.value);
                return (
                  <label
                    key={option.value}
                    className="flex cursor-pointer items-start gap-2 text-[13.5px] leading-6 text-ink"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(group.key, option.value)}
                      className="mt-1 size-3.5 shrink-0 accent-[#1d4436]"
                    />
                    <span>{option.label}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        ))}

        {activeCount > 0 ? (
          <button
            type="button"
            onClick={clearAll}
            className="inline-flex h-9 w-fit items-center gap-1.5 rounded-full border border-line-strong bg-white px-4 text-[13px] text-ink transition-colors hover:bg-shell"
          >
            <X className="size-3.5" aria-hidden="true" />
            Clear all filters
          </button>
        ) : null}
      </div>
    </div>
  );
}
