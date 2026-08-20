import { AlertTriangle, Check, CircleDot, Minus, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/components/ui/cn";
import type { Criterion, CriterionResult, CriterionStatus } from "@/lib/criteria/types";
import { IMPORTANCE_LABEL, type AlignmentSummary } from "@/lib/criteria/weights";
import { CRITERION_STATUS_LABELS, CRITERION_TYPE_LABELS, labelOr } from "@/lib/labels";

const STATUS_ICON: Record<CriterionStatus, typeof Check> = {
  met: Check,
  partially_met: CircleDot,
  not_met: Minus,
  unknown: CircleDot,
};

const STATUS_CLASS: Record<CriterionStatus, string> = {
  met: "text-ok",
  partially_met: "text-warn",
  not_met: "text-subtle",
  unknown: "text-subtle",
};

const AI_STATE_COPY: Record<string, string> = {
  disabled: "Written-response analysis is switched off for this pilot. Everything below is computed directly from the profile and the listing.",
  unavailable: "Written-response analysis is unavailable right now. Everything below still works, and it will be retried later.",
  pending: "Written-response analysis has not run for this application yet.",
  missing_api_key: "Written-response analysis is not configured in this environment. Everything below still works.",
};

export function CriteriaEvidence({
  criteria,
  results,
  summary,
  aiState,
  isPaidPosition,
  refreshControl,
}: {
  criteria: Criterion[];
  results: CriterionResult[];
  summary: AlignmentSummary;
  aiState: "ready" | "disabled" | "unavailable" | "pending" | "missing_api_key";
  isPaidPosition: boolean;
  refreshControl?: React.ReactNode;
}) {
  const byCriterion = new Map<string, CriterionResult[]>();
  for (const result of results) {
    byCriterion.set(result.criterionId, [...(byCriterion.get(result.criterionId) ?? []), result]);
  }

  const required = criteria.filter((criterion) => criterion.required);
  const preferred = criteria.filter((criterion) => !criterion.required);

  function Row({ criterion }: { criterion: Criterion }) {
    const entries = byCriterion.get(criterion.id) ?? [];
    const deterministic = entries.find((entry) => entry.source === "deterministic");
    const assisted = entries.find((entry) => entry.source === "ai_assisted");
    const primary = deterministic ?? assisted;
    const status = primary?.status ?? "unknown";
    const Icon = STATUS_ICON[status];

    return (
      <li className="rounded-[10px] border border-line bg-white px-4 py-3.5">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1.5">
          <p className="text-[14.5px] font-medium leading-6 text-ink">{criterion.label}</p>
          <span className={cn("inline-flex items-center gap-1.5 text-[12px] font-medium", STATUS_CLASS[status])}>
            <Icon className="size-3.5" aria-hidden="true" />
            {labelOr(CRITERION_STATUS_LABELS, status)}
          </span>
        </div>

        <p className="mt-1 text-[11.5px] text-subtle">
          Requested: {criterion.required ? "Required" : IMPORTANCE_LABEL[criterion.importance]}. Type:{" "}
          {labelOr(CRITERION_TYPE_LABELS, criterion.type).toLowerCase()}
        </p>

        {criterion.description ? (
          <p className="mt-1.5 text-[13px] leading-6 text-muted">{criterion.description}</p>
        ) : null}

        {deterministic && deterministic.evidence.length > 0 ? (
          <ul className="mt-2.5 flex flex-col gap-1">
            {deterministic.evidence.map((line, index) => (
              <li key={index} className="text-[13.5px] leading-6 text-muted">
                {line}
              </li>
            ))}
          </ul>
        ) : null}

        {assisted && assisted.evidence.length > 0 ? (
          <div className="mt-3 rounded-[8px] border border-line bg-shell/70 px-3 py-2.5">
            <p className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-subtle">
              <Sparkles className="size-3" aria-hidden="true" />
              From the written application
            </p>
            <ul className="mt-1.5 flex flex-col gap-1.5">
              {assisted.evidence.map((line, index) => (
                <li key={index} className="text-[13px] leading-6 text-muted">
                  {line}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {!deterministic && !assisted ? (
          <p className="mt-2 text-[13px] leading-6 text-subtle">
            No evidence has been gathered for this criterion yet.
          </p>
        ) : null}
      </li>
    );
  }

  return (
    <section className="rounded-[12px] border border-line bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <h2 className="font-display text-[19px] text-ink" style={{ letterSpacing: "-0.4px" }}>
            Criteria alignment
          </h2>
          <p className="mt-1 text-[12.5px] leading-5 text-muted">
            Evidence tied to the criteria you set for this project. This is not a ranking and it does not carry to any
            other position.
          </p>
        </div>
        {refreshControl}
      </div>

      <div className="border-b border-line bg-shell/50 px-5 py-4">
        <div className="flex flex-wrap gap-x-8 gap-y-3">
          <div>
            <p className="text-[11.5px] text-subtle">Required conditions</p>
            <p className="mt-1 text-[15px] text-ink">
              {summary.requiredTotal === 0
                ? "None set"
                : `${summary.requiredMet} of ${summary.requiredTotal} met`}
              {summary.requiredUnknown > 0 ? `, ${summary.requiredUnknown} not enough information` : ""}
            </p>
          </div>
          <div>
            <p className="text-[11.5px] text-subtle">Preference coverage</p>
            <p className="mt-1 text-[15px] text-ink">
              {summary.preferencePercent === null
                ? "No preferred criteria scored"
                : `${summary.preferencePercent} percent of the preferred criteria that could be evaluated`}
            </p>
          </div>
          {summary.unscoredPreferences > 0 ? (
            <div>
              <p className="text-[11.5px] text-subtle">Not scored</p>
              <p className="mt-1 text-[15px] text-ink">
                {summary.unscoredPreferences} criteria had no information either way
              </p>
            </div>
          ) : null}
        </div>

        <p className="mt-3 text-[12px] leading-5 text-subtle">
          Preferred criteria are weighted against each other and normalized, so a missing item costs only its own share.
          Criteria with no information are left out of the calculation rather than counted as a failure.
        </p>
      </div>

      {aiState !== "ready" ? (
        <div className="flex items-start gap-2.5 border-b border-line bg-gold-soft/60 px-5 py-3">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warn" aria-hidden="true" />
          <p className="text-[12.5px] leading-5 text-warn">{AI_STATE_COPY[aiState] ?? AI_STATE_COPY.unavailable}</p>
        </div>
      ) : null}

      {isPaidPosition ? (
        <div className="border-b border-line px-5 py-3">
          <Badge tone="outline">
            Paid position: automated candidate ordering is disabled. Evidence only.
          </Badge>
        </div>
      ) : null}

      <div className="px-5 py-4">
        {criteria.length === 0 ? (
          <p className="text-[13.5px] leading-6 text-muted">
            No criteria were set for this position, so there is nothing to evaluate against. You can add criteria from
            the edit flow at any time.
          </p>
        ) : (
          <>
            {required.length > 0 ? (
              <div>
                <p className="mb-2 text-[12px] font-medium text-subtle">Required</p>
                <ul className="flex flex-col gap-2.5">
                  {required.map((criterion) => (
                    <Row key={criterion.id} criterion={criterion} />
                  ))}
                </ul>
              </div>
            ) : null}

            {preferred.length > 0 ? (
              <div className={required.length > 0 ? "mt-5" : ""}>
                <p className="mb-2 text-[12px] font-medium text-subtle">Preferred</p>
                <ul className="flex flex-col gap-2.5">
                  {preferred.map((criterion) => (
                    <Row key={criterion.id} criterion={criterion} />
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}
