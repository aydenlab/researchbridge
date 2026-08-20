import { AlertTriangle } from "lucide-react";

export function LegalNotice() {
  return (
    <div className="mb-10 flex gap-3 rounded-[10px] border border-[#e6d7ae] bg-gold-soft px-4 py-3.5">
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden="true" />
      <p className="text-[13.5px] leading-6 text-warn">
        This page is a working placeholder written for the pilot. It has not been reviewed by a lawyer and is not a
        legal agreement. It will be replaced with a reviewed version before ResearchBridge operates beyond the pilot.
      </p>
    </div>
  );
}

export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-line py-8 first-of-type:border-t-0 first-of-type:pt-0">
      <h2 className="font-display text-[24px] text-ink" style={{ letterSpacing: "-0.4px" }}>
        {title}
      </h2>
      <div className="rb-measure mt-4 text-[15px] leading-7 text-muted [&_p+p]:mt-4">{children}</div>
    </section>
  );
}
