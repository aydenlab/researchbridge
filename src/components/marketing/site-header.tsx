"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { Wordmark } from "./brand";

const LINKS = [
  { href: "/opportunities", label: "Find Research" },
  { href: "/for-researchers", label: "For Researchers" },
  { href: "/how-it-works", label: "How It Works" },
  { href: "/about", label: "About" },
];

export function SiteHeader({ signedIn = false, homeHref = "/dashboard" }: { signedIn?: boolean; homeHref?: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <header className="sticky top-0 z-50">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-white/75 backdrop-blur-md" />
      <div className="flex w-full items-center justify-between px-4 py-2.5 sm:px-6">
        <div className="flex min-w-0 items-center gap-4">
          <Wordmark />
        </div>

        <nav aria-label="Primary" className="flex items-center gap-2.5 sm:gap-6">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "hidden text-[13px] font-medium tracking-[0.14px] transition-opacity hover:opacity-70 sm:inline-flex sm:text-sm",
                pathname.startsWith(link.href) ? "text-ink underline decoration-line-strong underline-offset-[6px]" : "text-ink",
              )}
            >
              {link.label}
            </Link>
          ))}

          {signedIn ? (
            <ButtonLink href={homeHref} size="sm" className="tracking-[0.14px]">
              Open ResearchBridge
            </ButtonLink>
          ) : (
            <>
              <Link
                href="/signin"
                className="hidden text-[13px] font-medium tracking-[0.14px] transition-opacity hover:opacity-70 sm:inline-flex sm:text-sm"
              >
                Sign In
              </Link>
              <ButtonLink href="/signup" size="sm" className="tracking-[0.14px]">
                Sign Up
              </ButtonLink>
            </>
          )}

          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            className="inline-flex size-8 items-center justify-center rounded-full border border-line-strong bg-white text-ink sm:hidden"
          >
            {open ? <X className="size-4" /> : <Menu className="size-4" />}
            <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
          </button>
        </nav>
      </div>

      {open ? (
        <div id="mobile-nav" className="rb-fade-in border-y border-line bg-white px-4 py-3 sm:hidden">
          <ul className="flex flex-col">
            {LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="block border-b border-line py-2.5 text-[15px] text-ink last:border-0">
                  {link.label}
                </Link>
              </li>
            ))}
            {!signedIn ? (
              <li>
                <Link href="/signin" className="block py-2.5 text-[15px] text-ink">
                  Sign In
                </Link>
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </header>
  );
}
