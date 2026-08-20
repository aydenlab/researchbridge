import Link from "next/link";
import { cn } from "@/components/ui/cn";
import type { PilotMetric } from "@/lib/queries/admin";

export function MetricGrid({ metrics, columns = 4 }: { metrics: PilotMetric[]; columns?: number }) {
  return (
    <div
      className={cn(
        "grid gap-3",
        columns === 2 ? "sm:grid-cols-2" : columns === 3 ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-4",
      )}
    >
      {metrics.map((metric) => (
        <div key={metric.label} className="rounded-[10px] border border-line bg-white px-4 py-3.5">
          <p className="text-[12px] text-subtle">{metric.label}</p>
          <p className={cn("mt-1.5 font-display text-[24px] leading-none", metric.known ? "text-ink" : "text-subtle")}>
            {metric.value}
          </p>
          {metric.detail ? <p className="mt-1.5 text-[12px] leading-5 text-muted">{metric.detail}</p> : null}
          {!metric.known ? (
            <p className="mt-1.5 text-[11px] text-subtle">Not yet measurable</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function AdminPanel({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[12px] border border-line bg-white">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <h2 className="font-display text-[19px] text-ink" style={{ letterSpacing: "-0.4px" }}>
            {title}
          </h2>
          {description ? <p className="mt-1 text-[12.5px] leading-5 text-muted">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function DataTable({
  columns,
  rows,
  caption,
  empty,
}: {
  columns: string[];
  rows: React.ReactNode[][];
  caption: string;
  empty: string;
}) {
  if (rows.length === 0) {
    return <p className="px-5 py-8 text-center text-[13.5px] text-muted">{empty}</p>;
  }

  return (
    <div className="overflow-x-auto rb-scroll">
      <table className="w-full min-w-[720px] text-left">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-line bg-shell/60">
            {columns.map((column) => (
              <th key={column} scope="col" className="px-4 py-2.5 text-[11.5px] font-medium text-subtle">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-b border-line last:border-b-0 align-top hover:bg-shell/50">
              {row.map((cell, position) => (
                <td key={position} className="px-4 py-3 text-[13px] text-muted">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function FilterTabs({
  base,
  current,
  tabs,
}: {
  base: string;
  current: string;
  tabs: { value: string; label: string; count?: number }[];
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map((tab) => (
        <Link
          key={tab.value || "all"}
          href={tab.value ? `${base}?filter=${tab.value}` : base}
          aria-current={current === tab.value ? "page" : undefined}
          className={
            current === tab.value
              ? "inline-flex h-8 items-center gap-2 rounded-full bg-moss px-3.5 text-[13px] font-medium text-forest"
              : "inline-flex h-8 items-center gap-2 rounded-full border border-line bg-white px-3.5 text-[13px] text-muted hover:text-ink"
          }
        >
          {tab.label}
          {tab.count !== undefined ? <span className="text-[11.5px] text-subtle">{tab.count}</span> : null}
        </Link>
      ))}
    </div>
  );
}
