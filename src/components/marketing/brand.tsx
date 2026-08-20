import Image from "next/image";
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

export function Logo({ className, priority = false }: { className?: string; priority?: boolean }) {
  return (
    <Image
      src="/logo.png"
      alt="ResearchBridge"
      width={240}
      height={96}
      priority={priority}
      className={cn("h-8 w-auto sm:h-9", className)}
    />
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
