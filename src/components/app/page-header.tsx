export function PageHeader({
  eyebrow,
  title,
  lede,
  actions,
}: {
  eyebrow?: string;
  title: string;
  lede?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-[12px] font-medium uppercase tracking-[0.12em] text-subtle">{eyebrow}</p>
        ) : null}
        <h1 className="mt-1.5 font-display text-[28px] text-ink sm:text-[32px]" style={{ letterSpacing: "-0.6px" }}>
          {title}
        </h1>
        {lede ? <p className="mt-2 max-w-2xl text-[15px] leading-7 text-muted">{lede}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2.5">{actions}</div> : null}
    </header>
  );
}

export function StatGrid({ stats }: { stats: { label: string; value: string; hint?: string }[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <div key={stat.label} className="rounded-[10px] border border-line bg-white px-4 py-3.5">
          <p className="text-[12px] uppercase tracking-[0.1em] text-subtle">{stat.label}</p>
          <p className="mt-1.5 font-display text-[26px] leading-none text-ink">{stat.value}</p>
          {stat.hint ? <p className="mt-1.5 text-[12.5px] leading-5 text-muted">{stat.hint}</p> : null}
        </div>
      ))}
    </div>
  );
}
