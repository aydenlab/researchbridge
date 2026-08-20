import { cn } from "./cn";

type Tone = "neutral" | "forest" | "gold" | "clay" | "ok" | "warn" | "bad" | "outline";

const tones: Record<Tone, string> = {
  neutral: "bg-cream text-muted border-line-strong",
  forest: "bg-moss text-forest border-[#c9ddd0]",
  gold: "bg-gold-soft text-warn border-[#e6d7ae]",
  clay: "bg-clay-soft text-clay border-[#eccdc2]",
  ok: "bg-moss text-ok border-[#c2dccc]",
  warn: "bg-gold-soft text-warn border-[#e6d7ae]",
  bad: "bg-[#f9ecea] text-bad border-[#e8cdc9]",
  outline: "bg-white text-muted border-line",
};

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11.5px] font-medium leading-5",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Tag({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border border-line bg-shell px-2 py-0.5 text-[11.5px] text-muted",
        className,
      )}
    >
      {children}
    </span>
  );
}
