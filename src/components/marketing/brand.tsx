import Link from "next/link";
import { cn } from "@/components/ui/cn";

export function BridgeMark({ className, tone = "ink" }: { className?: string; tone?: "ink" | "white" }) {
  const stroke = tone === "white" ? "#ffffff" : "#14201a";
  const accent = tone === "white" ? "#e0b855" : "#b08c33";
  return (
    <svg viewBox="0 0 40 40" className={className} role="img" aria-label="ResearchBridge mark">
      <rect x="0.75" y="0.75" width="38.5" height="38.5" rx="9" fill="none" stroke={stroke} strokeOpacity="0.22" />
      <path d="M8 26.5C8 18.5 13.6 13 20 13s12 5.5 12 13.5" fill="none" stroke={stroke} strokeWidth="2.1" strokeLinecap="round" />
      <path d="M8 26.5h24" stroke={stroke} strokeWidth="2.1" strokeLinecap="round" />
      <path d="M14 26.5v-5.2M20 26.5V13.4M26 26.5v-5.2" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.55" />
      <circle cx="8" cy="26.5" r="2.6" fill={accent} />
      <circle cx="32" cy="26.5" r="2.6" fill={accent} />
    </svg>
  );
}

export function Wordmark({
  tone = "ink",
  withTagline = true,
  href = "/",
}: {
  tone?: "ink" | "white";
  withTagline?: boolean;
  href?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-2 transition-opacity hover:opacity-80",
        tone === "white" ? "text-white" : "text-ink",
      )}
    >
      <BridgeMark className="size-8 shrink-0 sm:size-9" tone={tone} />
      <span className="flex flex-col leading-none">
        <span className="font-mono text-[19px] font-semibold tracking-[-0.3px] sm:text-[21px]">ResearchBridge</span>
        {withTagline ? (
          <span className="mt-0.5 ml-0.5 font-mono text-[9px] font-normal tracking-[0.02em] opacity-60 sm:text-[10px]">
            Research that is looking for you.
          </span>
        ) : null}
      </span>
    </Link>
  );
}
