import {
  Building2,
  CalendarClock,
  Check,
  CircleDot,
  Clock,
  FileText,
  MapPin,
  Search,
  Sparkles,
  UserRound,
} from "lucide-react";

export function DiscoveryMock() {
  return (
    <div className="w-full max-w-[420px] rounded-2xl bg-white p-3 rb-panel">
      <div className="flex items-center gap-2.5 rounded-xl border border-ink/[0.08] bg-white px-3 py-2">
        <Search className="size-3.5 shrink-0 text-subtle" aria-hidden="true" />
        <p className="min-h-[20px] min-w-0 flex-1 text-[12.5px] tracking-[0.14px] text-ink">
          clinical outcomes, 8 hours per week
          <span aria-hidden="true" className="rb-caret ml-0.5 inline-block h-[12px] w-[6px] bg-ink/70 align-[-2px]" />
        </p>
      </div>

      <div className="pt-2">
        <div className="flex flex-wrap gap-1.5">
          {["Health Sciences", "Accepting beginners", "Academic credit"].map((chip) => (
            <span
              key={chip}
              className="inline-flex items-center gap-1.5 rounded-lg border border-ink/[0.08] bg-white px-2 py-1 text-[11px] tracking-[0.14px] text-muted"
            >
              <Check className="size-3 shrink-0 text-[#3f7a52]" aria-hidden="true" />
              {chip}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-ink/[0.08] p-3">
        <p className="text-[13px] font-medium leading-5 text-ink">
          Undergraduate Research Assistant, Cardiovascular Outcomes
        </p>
        <p className="mt-1 text-[11.5px] text-muted">Dr. Amara Okonjo, Health Research Methods, Evidence, and Impact</p>
        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-muted">
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3" aria-hidden="true" />6 to 10 hours per week
          </span>
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-3" aria-hidden="true" />
            Hybrid
          </span>
          <span className="inline-flex items-center gap-1">
            <CalendarClock className="size-3" aria-hidden="true" />
            Closes 30 Sep
          </span>
        </div>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {["Python", "Statistics", "Literature review"].map((tag) => (
            <span key={tag} className="rounded-md border border-line bg-shell px-1.5 py-0.5 text-[10.5px] text-muted">
              {tag}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between rounded-lg px-1.5 py-1 text-[11.5px]">
        <span className="font-medium tracking-[0.14px] text-ink">Compensation</span>
        <span className="font-mono text-[10px] text-muted">academic credit or volunteer</span>
      </div>
    </div>
  );
}

const PIPELINE = [
  { Icon: UserRound, label: "Profile", detail: "one profile, reused everywhere" },
  { Icon: Building2, label: "Position", detail: "researcher posts real opening" },
  { Icon: FileText, label: "Application", detail: "project-specific questions" },
  { Icon: Sparkles, label: "Evidence", detail: "criteria the researcher set" },
  { Icon: CircleDot, label: "Contact", detail: "researcher reaches out" },
];

export function PipelineMock() {
  return (
    <div className="w-full max-w-[400px] rounded-2xl bg-white p-3 rb-panel">
      <div className="flex items-end gap-2.5 rounded-xl border border-ink/[0.08] bg-white px-3 py-2">
        <p className="min-h-[20px] min-w-0 flex-1 text-[12.5px] tracking-[0.14px] text-ink">
          Post a position from this project
          <span aria-hidden="true" className="rb-caret ml-0.5 inline-block h-[12px] w-[6px] bg-ink/70 align-[-2px]" />
        </p>
        <span
          aria-hidden="true"
          className="flex size-5 shrink-0 items-center justify-center rounded-full bg-ink text-white"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="size-3">
            <path d="m5 12 7-7 7 7" />
            <path d="M12 19V5" />
          </svg>
        </span>
      </div>

      <p className="pb-1 pt-3 text-[12px] tracking-[0.14px] text-ink">
        <span className="font-medium">ResearchBridge</span> building the listing
      </p>

      {PIPELINE.map((step) => (
        <div key={step.label} className="flex items-center gap-2 rounded-md px-1.5 py-[3px] text-[11.5px]">
          <step.Icon className="size-3 shrink-0 text-subtle" aria-hidden="true" />
          <span className="shrink-0 font-medium tracking-[0.14px] text-ink">{step.label}</span>
          <span className="truncate font-mono text-[10px] text-muted">{step.detail}</span>
          <span className="ml-auto shrink-0">
            <Check className="size-3 text-[#3f7a52]" aria-hidden="true" />
          </span>
        </div>
      ))}

      <div className="mt-2 flex items-center gap-2 rounded-lg border border-ink/[0.08] bg-shell px-2.5 py-1.5">
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-ink">
          <Check className="size-3 text-[#3f7a52]" aria-hidden="true" />
          Live
        </span>
        <span className="font-mono text-[10px] text-muted">students can apply</span>
      </div>
    </div>
  );
}

const EVIDENCE_ROWS = [
  {
    label: "Availability of at least 6 hours per week",
    requested: "Required",
    status: "Requirement met",
    detail: "Student availability: 10 hours per week.",
    tone: "met" as const,
  },
  {
    label: "Python or R",
    requested: "Preferred, high importance",
    status: "Evidence found",
    detail: "Describes using Python and pandas to clean longitudinal clinical data.",
    tone: "met" as const,
  },
  {
    label: "BIOLOGY 2B03 or equivalent",
    requested: "Preferred, medium importance",
    status: "Evidence found",
    detail: "BIOLOGY 2B03 listed under completed coursework.",
    tone: "met" as const,
  },
  {
    label: "Cell culture",
    requested: "Preferred, low importance",
    status: "No information found",
    detail: "Nothing in this application relates to this criterion.",
    tone: "none" as const,
  },
];

export function EvidenceMock() {
  return (
    <div className="w-full rounded-2xl border border-ink/[0.08] bg-white p-4 rb-panel-sm sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
        <div>
          <p className="text-[13.5px] font-medium text-ink">Jordan Adeyemi</p>
          <p className="text-[11.5px] text-muted">Health Sciences, Year 2, 10 hours per week</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#c9ddd0] bg-moss px-2.5 py-0.5 text-[11.5px] font-medium text-forest">
          Criteria alignment, not a ranking
        </span>
      </div>

      <ul className="mt-3 flex flex-col gap-2.5">
        {EVIDENCE_ROWS.map((row) => (
          <li key={row.label} className="rounded-[10px] border border-line bg-shell/60 px-3 py-2.5">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <p className="text-[12.5px] font-medium text-ink">{row.label}</p>
              <span
                className={
                  row.tone === "met"
                    ? "inline-flex items-center gap-1 text-[11px] font-medium text-ok"
                    : "inline-flex items-center gap-1 text-[11px] font-medium text-subtle"
                }
              >
                {row.tone === "met" ? (
                  <Check className="size-3" aria-hidden="true" />
                ) : (
                  <CircleDot className="size-3" aria-hidden="true" />
                )}
                {row.status}
              </span>
            </div>
            <p className="mt-0.5 text-[11px] text-subtle">Requested: {row.requested}</p>
            <p className="mt-1 text-[12px] leading-5 text-muted">{row.detail}</p>
          </li>
        ))}
      </ul>

      <p className="mt-3 border-t border-line pt-3 text-[11.5px] leading-5 text-subtle">
        Evidence is tied to the criteria this researcher wrote for this project. No student carries a score between
        projects, and the researcher makes every decision.
      </p>
    </div>
  );
}
