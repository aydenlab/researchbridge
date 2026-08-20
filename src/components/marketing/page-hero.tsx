import { cn } from "@/components/ui/cn";

export function PageHero({
  eyebrow,
  title,
  lede,
  gradient = "gradient-meadow",
  children,
}: {
  eyebrow: string;
  title: string;
  lede?: string;
  gradient?: "gradient-hero" | "gradient-meadow" | "gradient-sand" | "gradient-slate" | "gradient-ink";
  children?: React.ReactNode;
}) {
  const onSand = gradient === "gradient-sand";
  return (
    <section className="px-4 pb-0 pt-2 sm:px-6">
      <div
        className="rb-drift overflow-hidden rounded-2xl px-6 py-16 sm:px-12 sm:py-20"
        style={{ backgroundImage: `url(/${gradient}.webp)`, backgroundSize: "150% 150%" }}
      >
        <div className="mx-auto max-w-3xl">
          <p
            className={cn(
              "mb-5 text-[12px] font-medium uppercase tracking-[0.14em]",
              onSand ? "text-ink/60" : "text-white/75",
            )}
          >
            {eyebrow}
          </p>
          <h1
            className={cn("font-display text-3xl sm:text-4xl md:text-5xl", onSand ? "text-ink" : "text-white")}
            style={{
              fontWeight: 400,
              lineHeight: 1.1,
              letterSpacing: "-0.7px",
              textShadow: onSand ? undefined : "0 2px 20px rgba(0,0,0,0.15)",
            }}
          >
            {title}
          </h1>
          {lede ? (
            <p className={cn("mt-5 max-w-2xl text-[16px] leading-7", onSand ? "text-ink/75" : "text-white/85")}>
              {lede}
            </p>
          ) : null}
          {children ? <div className="mt-8">{children}</div> : null}
        </div>
      </div>
    </section>
  );
}

export function Prose({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rb-measure text-[15.5px] leading-7 text-muted [&_p+p]:mt-4", className)}>{children}</div>
  );
}

export function ContentSection({
  eyebrow,
  title,
  children,
  className,
}: {
  eyebrow?: string;
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("px-5 py-14 sm:px-6 sm:py-20", className)}>
      <div className="mx-auto max-w-5xl">
        {eyebrow ? <p className="mb-5 text-[13px] font-medium tracking-[0.14px] text-subtle">{eyebrow}</p> : null}
        {title ? (
          <h2
            className="mb-8 max-w-3xl font-display text-3xl text-ink sm:text-4xl"
            style={{ fontWeight: 400, lineHeight: 1.1, letterSpacing: "-0.5px" }}
          >
            {title}
          </h2>
        ) : null}
        {children}
      </div>
    </section>
  );
}
