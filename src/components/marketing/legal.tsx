import { Info } from "lucide-react";

export function LegalNotice({ updated }: { updated: string }) {
  return (
    <div className="mb-10 flex gap-3 rounded-[10px] border border-line bg-shell px-4 py-3.5">
      <Info className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
      <div className="text-[13px] leading-6 text-muted">
        <p>
          Last updated {updated}. This document was written by the ResearchBridge team rather than by a law firm. It
          describes how the product actually behaves, in plain language.
        </p>
        <p className="mt-1.5">
          If anything here is unclear or appears wrong, write to{" "}
          <a href="mailto:hello@myresearchbridge.com" className="underline decoration-line-strong underline-offset-4 hover:text-ink">
            hello@myresearchbridge.com
          </a>{" "}
          and we will correct it.
        </p>
      </div>
    </div>
  );
}

export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-line py-8 first-of-type:border-t-0 first-of-type:pt-0">
      <h2 className="font-display text-[24px] text-ink" style={{ letterSpacing: "-0.4px" }}>
        {title}
      </h2>
      <div className="rb-measure mt-4 text-[15px] leading-7 text-muted [&_p+p]:mt-4 [&_ul]:mt-4">{children}</div>
    </section>
  );
}

export function LegalList({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-col gap-2.5">
      {items.map((item) => (
        <li key={item} className="flex gap-3">
          <span aria-hidden="true" className="mt-3 h-px w-3 shrink-0 bg-line-strong" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
