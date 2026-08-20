import Link from "next/link";
import { cn } from "@/components/ui/cn";

export function BridgeMark({ className, tone = "ink" }: { className?: string; tone?: "ink" | "white" }) {
  const fill = tone === "white" ? "#ffffff" : "#1d4436";
  const accent = tone === "white" ? "#b8d6bd" : "#b8d6bd";
  return (
    <svg viewBox="0 0 40 40" className={className} role="img" aria-label="ResearchBridge mark">
      <rect width="40" height="40" rx="11" fill={fill} />
      <path d="M8 27V18.5C8 14.36 11.36 11 15.5 11S23 14.36 23 18.5V27" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
      <path d="M17 27V18.5C17 14.36 20.36 11 24.5 11S32 14.36 32 18.5V27" fill="none" stroke={accent} strokeWidth="3" strokeLinecap="round" />
      <path d="M6.5 27.5h27" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ className, priority = false }: { className?: string; priority?: boolean }) {
  void priority;
  return (
    <span className={cn("inline-flex items-center gap-2 text-ink", className)} role="img" aria-label="ResearchBridge">
      <BridgeMark className="size-8 shrink-0 sm:size-9" />
      <span className="whitespace-nowrap text-[17px] font-semibold leading-none tracking-[-0.01em] sm:text-[18px]">
        Research<span className="text-forest">Bridge</span>
      </span>
    </span>
  );
}

export function Wordmark({
  withTagline = false,
  href = "/",
  priority = false,
}: {
  tone?: "ink" | "white";
  withTagline?: boolean;
  href?: string;
  priority?: boolean;
}) {
  return (
    <Link href={href} className="inline-flex items-center transition-opacity hover:opacity-80">
      <Logo priority={priority} className="h-9 w-auto sm:h-10" />
      {withTagline ? (
        <span className="ml-3 hidden border-l border-line pl-3 font-mono text-[10px] leading-4 text-muted lg:block">
          Research that is
          <br />
          looking for you.
        </span>
      ) : null}
    </Link>
  );
}
