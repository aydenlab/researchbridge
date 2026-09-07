"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { StatusPill } from "@/components/app/status-pill";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/components/ui/cn";
import { Input, Select } from "@/components/ui/field";
import type { ApplicationStatus } from "@/lib/application-status";
import { formatShortDate } from "@/lib/format";
import {
  COURSE_TYPE_LABELS,
  COURSE_TYPE_ORDER,
  DURATION_LABELS,
  PROGRAM_CATEGORY_LABELS,
  PROGRAM_CATEGORY_ORDER,
  labelOr,
} from "@/lib/labels";
import type { ApplicantRow } from "@/lib/queries/applications";

const FILTERS = [
  { value: "all", label: "All applicants" },
  { value: "unreviewed", label: "Not yet opened" },
  { value: "shortlisted", label: "Shortlisted and beyond" },
  { value: "declined", label: "Not moving forward" },
];

/**
 * Filtering happens in the browser rather than the URL because the whole
 * applicant list is already loaded for the rail. A round trip per checkbox
 * would make narrowing a pool of forty people feel slower than reading it.
 */
export function ApplicantRail({ opportunityId, applicants }: { opportunityId: string; applicants: ApplicantRow[] }) {
  const pathname = usePathname();
  const params = useParams<{ applicationId?: string }>();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [courseTypes, setCourseTypes] = useState<string[]>([]);
  const [programs, setPrograms] = useState<string[]>([]);

  // Only offer the values that are actually present in this pool. A filter that
  // can only ever return nothing is noise on the screen.
  const availableCourseTypes = useMemo(
    () => COURSE_TYPE_ORDER.filter((value) => applicants.some((applicant) => applicant.courseTypes.includes(value))),
    [applicants],
  );
  const availablePrograms = useMemo(
    () => PROGRAM_CATEGORY_ORDER.filter((value) => applicants.some((applicant) => applicant.programCategory === value)),
    [applicants],
  );

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return applicants.filter((applicant) => {
      if (filter === "unreviewed" && applicant.status !== "submitted") return false;
      if (filter === "shortlisted" && !["shortlisted", "researcher_contacted", "interview", "accepted"].includes(applicant.status)) {
        return false;
      }
      if (filter === "declined" && !["declined", "withdrawn", "position_filled"].includes(applicant.status)) return false;
      if (courseTypes.length > 0 && !courseTypes.some((value) => applicant.courseTypes.includes(value))) return false;
      if (programs.length > 0 && !(applicant.programCategory && programs.includes(applicant.programCategory))) return false;
      if (!term) return true;
      const haystack = [applicant.firstName, applicant.lastName, applicant.preferredName, applicant.program]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [applicants, courseTypes, filter, programs, query]);

  const selected = params.applicationId;
  const isIndex = pathname.endsWith("/applicants");
  const structuralCount = courseTypes.length + programs.length;

  function toggle(list: string[], setList: (next: string[]) => void, value: string) {
    setList(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);
  }

  return (
    <aside className={cn("min-w-0", selected && !isIndex ? "hidden xl:block" : "block")}>
      <div className="rounded-[12px] border border-line bg-white">
        <div className="border-b border-line p-3.5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-subtle" aria-hidden="true" />
            <label htmlFor="applicant-search" className="sr-only">
              Search applicants
            </label>
            <Input
              id="applicant-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Name or program"
              className="pl-9"
            />
          </div>
          <div className="mt-2.5">
            <label htmlFor="applicant-filter" className="sr-only">
              Filter applicants
            </label>
            <Select id="applicant-filter" value={filter} onChange={(event) => setFilter(event.target.value)}>
              {FILTERS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>

          {availableCourseTypes.length > 0 ? (
            <fieldset className="mt-3">
              <legend className="mb-1.5 text-[11.5px] font-medium text-subtle">Course type</legend>
              <div className="flex flex-wrap gap-1.5">
                {availableCourseTypes.map((value) => {
                  const active = courseTypes.includes(value);
                  return (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={active}
                      onClick={() => toggle(courseTypes, setCourseTypes, value)}
                      className={cn(
                        "rounded-full border px-2.5 py-0.5 text-[11.5px] transition-colors",
                        active ? "border-forest bg-moss text-forest" : "border-line-strong bg-white text-ink hover:bg-shell",
                      )}
                    >
                      {COURSE_TYPE_LABELS[value]}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ) : null}

          {availablePrograms.length > 0 ? (
            <fieldset className="mt-3">
              <legend className="mb-1.5 text-[11.5px] font-medium text-subtle">Program</legend>
              <div className="flex flex-wrap gap-1.5">
                {availablePrograms.map((value) => {
                  const active = programs.includes(value);
                  return (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={active}
                      onClick={() => toggle(programs, setPrograms, value)}
                      className={cn(
                        "rounded-full border px-2.5 py-0.5 text-[11.5px] transition-colors",
                        active ? "border-forest bg-moss text-forest" : "border-line-strong bg-white text-ink hover:bg-shell",
                      )}
                    >
                      {PROGRAM_CATEGORY_LABELS[value]}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ) : null}

          <div className="mt-2.5 flex items-center justify-between gap-2">
            <p className="text-[12.5px] text-muted" aria-live="polite">
              Showing {visible.length} of {applicants.length}
            </p>
            {structuralCount > 0 ? (
              <button
                type="button"
                onClick={() => {
                  setCourseTypes([]);
                  setPrograms([]);
                }}
                className="inline-flex items-center gap-1 text-[12px] text-muted hover:text-ink"
              >
                <X className="size-3" aria-hidden="true" />
                Clear {structuralCount}
              </button>
            ) : null}
          </div>
        </div>

        {visible.length === 0 ? (
          <p className="px-4 py-8 text-center text-[13.5px] leading-6 text-muted">
            {applicants.length === 0
              ? "No applications yet. They appear here as soon as students submit."
              : "No applicants match this filter. Try removing it."}
          </p>
        ) : (
          <ul className="max-h-[calc(100vh-320px)] overflow-y-auto rb-scroll">
            {visible.map((applicant) => {
              const active = selected === applicant.id;
              return (
                <li key={applicant.id}>
                  <Link
                    href={`/researcher/opportunities/${opportunityId}/applicants/${applicant.id}`}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "block border-b border-line px-4 py-3.5 transition-colors",
                      active ? "border-l-2 border-l-forest bg-moss/40" : "hover:bg-shell/70",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[14px] font-medium leading-5 text-ink">
                        {applicant.preferredName ?? applicant.firstName} {applicant.lastName}
                      </p>
                      {applicant.status === "submitted" ? (
                        <span className="mt-0.5 shrink-0 rounded-full border border-[#eccdc2] bg-clay-soft px-2 py-0.5 text-[10.5px] font-medium text-clay">
                          New
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-[12.5px] text-muted">
                      {applicant.program ?? "Program not set"}
                      {applicant.yearLevel ? `, year ${applicant.yearLevel}` : ""}
                    </p>
                    <p className="mt-0.5 text-[12px] text-subtle">
                      {applicant.weeklyHours !== null ? `${applicant.weeklyHours} hours per week` : "Availability not set"}
                      {applicant.submittedAt ? `, ${formatShortDate(applicant.submittedAt)}` : ""}
                    </p>

                    {applicant.courseTypes.length > 0 || applicant.durations.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {applicant.courseTypes.map((value) => (
                          <Badge key={value} tone="neutral">
                            {labelOr(COURSE_TYPE_LABELS, value)}
                          </Badge>
                        ))}
                        {applicant.durations.map((value) => (
                          <Badge key={value} tone="outline">
                            {labelOr(DURATION_LABELS, value)}
                          </Badge>
                        ))}
                      </div>
                    ) : null}

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <StatusPill status={applicant.status as ApplicationStatus} />
                      {applicant.noteCount > 0 ? (
                        <span className="text-[11.5px] text-subtle">
                          {applicant.noteCount} {applicant.noteCount === 1 ? "note" : "notes"}
                        </span>
                      ) : null}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
