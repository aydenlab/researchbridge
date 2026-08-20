import Link from "next/link";
import { Check } from "lucide-react";
import { cn } from "@/components/ui/cn";

export type Step = { number: number; label: string; description: string };

export function OnboardingShell({
  title,
  intro,
  steps,
  current,
  basePath,
  furthest,
  children,
}: {
  title: string;
  intro: string;
  steps: Step[];
  current: number;
  basePath: string;
  furthest: number;
  children: React.ReactNode;
}) {
  const active = steps.find((step) => step.number === current) ?? steps[0];

  return (
    <div className="mx-auto max-w-[1180px] px-4 py-8 sm:px-6 sm:py-12">
      <div className="grid gap-8 lg:grid-cols-[260px_1fr] lg:gap-12">
        <aside>
          <p className="text-[12px] font-medium text-subtle">{title}</p>
          <p className="mt-2 text-[13.5px] leading-6 text-muted">{intro}</p>

          <ol className="mt-6 flex gap-1.5 overflow-x-auto pb-2 lg:mt-8 lg:flex-col lg:gap-0 lg:overflow-visible lg:pb-0">
            {steps.map((step) => {
              const done = step.number < furthest;
              const isCurrent = step.number === current;
              const reachable = step.number <= furthest;
              const content = (
                <span
                  className={cn(
                    "flex items-center gap-2.5 rounded-full border px-3 py-1.5 text-[13px] transition-colors lg:rounded-[8px] lg:border-0 lg:border-l-2 lg:px-3 lg:py-2.5",
                    isCurrent
                      ? "border-forest bg-moss font-medium text-forest lg:border-l-forest lg:bg-moss/60"
                      : reachable
                        ? "border-line bg-white text-muted hover:text-ink lg:border-l-line lg:bg-transparent"
                        : "border-line bg-white text-subtle lg:border-l-line lg:bg-transparent",
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-medium",
                      done ? "bg-forest text-white" : isCurrent ? "bg-forest text-white" : "bg-cream text-muted",
                    )}
                  >
                    {done ? <Check className="size-3" aria-hidden="true" /> : step.number}
                  </span>
                  <span className="whitespace-nowrap lg:whitespace-normal">{step.label}</span>
                </span>
              );

              return (
                <li key={step.number} className="shrink-0 lg:shrink">
                  {reachable ? (
                    <Link
                      href={`${basePath}?step=${step.number}`}
                      aria-current={isCurrent ? "step" : undefined}
                      className="block"
                    >
                      {content}
                    </Link>
                  ) : (
                    <span aria-disabled="true" className="block">
                      {content}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </aside>

        <div className="min-w-0">
          <div className="rounded-[12px] border border-line bg-white">
            <div className="border-b border-line px-5 py-5 sm:px-7 sm:py-6">
              <p className="text-[12px] font-medium text-subtle">
                Step {active.number} of {steps.length}
              </p>
              <h1 className="mt-2 font-display text-[26px] text-ink" style={{ letterSpacing: "-0.5px" }}>
                {active.label}
              </h1>
              <p className="mt-2 rb-measure text-[14px] leading-6 text-muted">{active.description}</p>
            </div>
            <div className="px-5 py-6 sm:px-7 sm:py-7">{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function StepActions({
  backHref,
  submitLabel = "Save and continue",
  pending,
  secondary,
}: {
  backHref?: string;
  submitLabel?: string;
  pending?: boolean;
  secondary?: React.ReactNode;
}) {
  return (
    <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-line pt-6">
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-10 items-center justify-center rounded-full bg-ink px-5 text-sm font-medium text-white transition-transform hover:scale-[1.03] hover:bg-ink/85 disabled:pointer-events-none disabled:opacity-50"
      >
        {pending ? "Saving" : submitLabel}
      </button>
      {backHref ? (
        <Link
          href={backHref}
          className="inline-flex h-10 items-center justify-center rounded-full border border-line-strong px-5 text-sm font-medium text-ink transition-colors hover:bg-shell"
        >
          Back
        </Link>
      ) : null}
      {secondary}
    </div>
  );
}
