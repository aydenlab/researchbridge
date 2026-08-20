import Link from "next/link";
import { BridgeMark } from "./brand";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { href: "/opportunities", label: "Find Research" },
      { href: "/for-researchers", label: "For Researchers" },
      { href: "/how-it-works", label: "How It Works" },
      { href: "/faq", label: "FAQ" },
    ],
  },
  {
    title: "Pilot",
    links: [
      { href: "/waitlist", label: "Join the student pilot" },
      { href: "/researchers/interest", label: "Recruit students" },
      { href: "/about", label: "About ResearchBridge" },
      { href: "/contact", label: "Contact" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
      { href: "/accessibility", label: "Accessibility" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-shell">
      <div className="mx-auto max-w-[1280px] px-5 py-12 sm:px-6 sm:py-14">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div className="max-w-xs">
            <div className="flex items-center gap-2">
              <BridgeMark className="size-8" />
              <span className="font-mono text-[17px] font-semibold tracking-[-0.3px] text-ink">ResearchBridge</span>
            </div>
            <p className="mt-3 text-[13px] leading-6 text-muted">
              Open research positions at your university, in one place, with applications written for the specific
              project.
            </p>
            <p className="mt-4 text-[13px] text-muted">
              <a href="mailto:hello@myresearchbridge.com" className="underline decoration-line-strong underline-offset-4 hover:text-ink">
                hello@myresearchbridge.com
              </a>
            </p>
          </div>

          {COLUMNS.map((column) => (
            <div key={column.title}>
              <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-subtle">{column.title}</p>
              <ul className="mt-4 flex flex-col gap-2.5">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-[13.5px] text-muted transition-colors hover:text-ink">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t border-line pt-6 text-[12.5px] text-subtle sm:flex-row sm:items-center sm:justify-between">
          <p>Copyright 2026 ResearchBridge. Pilot launching at McMaster University in September 2026.</p>
          <p>Built for university research recruiting.</p>
        </div>
      </div>
    </footer>
  );
}
