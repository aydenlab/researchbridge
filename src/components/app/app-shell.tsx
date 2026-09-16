"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Bell, ChevronDown, Inbox, Menu, X } from "lucide-react";
import { Avatar } from "@/components/app/avatar";
import { Logo } from "@/components/marketing/brand";
import { cn } from "@/components/ui/cn";

export type NavItem = { href: string; label: string };

export function AppHeader({
  nav,
  homeHref,
  displayName,
  email,
  photoFileId,
  roleLabel,
  unreadCount,
  unreadMessageCount,
}: {
  nav: NavItem[];
  homeHref: string;
  displayName: string | null;
  email: string;
  photoFileId: string | null;
  roleLabel: string;
  unreadCount: number;
  unreadMessageCount: number;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const navRef = useRef<HTMLElement | null>(null);
  const [navEdges, setNavEdges] = useState({ start: false, end: false });

  useEffect(() => {
    setMenuOpen(false);
    setAccountOpen(false);
  }, [pathname]);

  // An admin's nine destinations do not fit every window, so the strip scrolls.
  // When it does, the page they are on is brought into view and whichever edge
  // has more behind it is faded, so a clipped label reads as "there is more"
  // rather than as a layout that has gone wrong.
  useEffect(() => {
    const strip = navRef.current;
    if (!strip) return;

    const measure = () =>
      setNavEdges({
        start: strip.scrollLeft > 1,
        end: strip.scrollLeft + strip.clientWidth < strip.scrollWidth - 1,
      });

    strip.querySelector('[aria-current="page"]')?.scrollIntoView({ block: "nearest", inline: "nearest" });
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(strip);
    strip.addEventListener("scroll", measure, { passive: true });

    return () => {
      observer.disconnect();
      strip.removeEventListener("scroll", measure);
    };
  }, [pathname, nav]);

  const navMask =
    navEdges.start && navEdges.end
      ? "linear-gradient(to right, transparent, #000 28px, #000 calc(100% - 28px), transparent)"
      : navEdges.start
        ? "linear-gradient(to right, transparent, #000 28px)"
        : navEdges.end
          ? "linear-gradient(to right, #000 calc(100% - 28px), transparent)"
          : undefined;

  const isActive = (href: string) => pathname === href || (href !== homeHref && pathname.startsWith(`${href}/`));

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1560px] items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-4 xl:gap-6">
          <Link href={homeHref} className="inline-flex shrink-0 items-center gap-2 transition-opacity hover:opacity-80">
            <Logo className="h-8 w-auto sm:h-9" priority />
          </Link>

          {/*
            An admin carries nine destinations, so the row has to be allowed to
            run out of room rather than shrink into the account menu. Items keep
            their own width and the strip scrolls once they stop fitting.
          */}
          <nav
            ref={navRef}
            aria-label="Application"
            className="hidden min-w-0 flex-1 items-center gap-1 overflow-x-auto rb-hide-scroll lg:flex"
            style={navMask ? { maskImage: navMask } : undefined}
          >
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(item.href) ? "page" : undefined}
                className={cn(
                  "shrink-0 whitespace-nowrap rounded-full px-2.5 py-1.5 text-[13.5px] font-medium transition-colors xl:px-3",
                  isActive(item.href) ? "bg-moss text-forest" : "text-muted hover:bg-cream hover:text-ink",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/messages"
            className="relative inline-flex size-9 items-center justify-center rounded-full border border-line text-muted transition-colors hover:border-ink/30 hover:text-ink"
          >
            <Inbox className="size-4" aria-hidden="true" />
            {unreadMessageCount > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-4 items-center justify-center rounded-full bg-clay px-1 text-[10px] font-medium leading-4 text-white">
                {unreadMessageCount > 9 ? "9+" : unreadMessageCount}
              </span>
            ) : null}
            <span className="sr-only">
              Messages{unreadMessageCount > 0 ? `, ${unreadMessageCount} unread` : ", none unread"}
            </span>
          </Link>

          <Link
            href="/notifications"
            className="relative inline-flex size-9 items-center justify-center rounded-full border border-line text-muted transition-colors hover:border-ink/30 hover:text-ink"
          >
            <Bell className="size-4" aria-hidden="true" />
            {unreadCount > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-4 items-center justify-center rounded-full bg-clay px-1 text-[10px] font-medium leading-4 text-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            ) : null}
            <span className="sr-only">
              Notifications{unreadCount > 0 ? `, ${unreadCount} unread` : ", none unread"}
            </span>
          </Link>

          <div className="relative hidden lg:block">
            <button
              type="button"
              onClick={() => setAccountOpen((value) => !value)}
              aria-expanded={accountOpen}
              className="inline-flex items-center gap-2 rounded-full border border-line py-1 pl-1 pr-2.5 transition-colors hover:border-ink/30"
            >
              <Avatar fileId={photoFileId} name={displayName ?? email} className="size-7 text-[11px]" />
              <span className="max-w-[140px] truncate text-[13px] text-ink">{displayName ?? email}</span>
              <ChevronDown className="size-3.5 text-muted" aria-hidden="true" />
            </button>

            {accountOpen ? (
              <div className="rb-fade-in absolute right-0 mt-2 w-60 rounded-[10px] border border-line bg-white p-1.5 rb-panel-sm">
                <div className="border-b border-line px-3 py-2">
                  <p className="truncate text-[13px] font-medium text-ink">{displayName ?? "Your account"}</p>
                  <p className="truncate text-[12px] text-muted">{email}</p>
                  <p className="mt-1 text-[11px] text-subtle">{roleLabel}</p>
                </div>
                <Link href="/profile" className="block rounded-md px-3 py-2 text-[13.5px] text-ink hover:bg-cream">
                  Profile
                </Link>
                <form action="/api/signout" method="post">
                  <button
                    type="submit"
                    className="block w-full rounded-md px-3 py-2 text-left text-[13.5px] text-ink hover:bg-cream"
                  >
                    Sign out
                  </button>
                </form>
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => setMenuOpen((value) => !value)}
            aria-expanded={menuOpen}
            aria-controls="app-mobile-nav"
            className="inline-flex size-9 items-center justify-center rounded-full border border-line text-ink lg:hidden"
          >
            {menuOpen ? <X className="size-4" /> : <Menu className="size-4" />}
            <span className="sr-only">{menuOpen ? "Close menu" : "Open menu"}</span>
          </button>
        </div>
      </div>

      {menuOpen ? (
        <div id="app-mobile-nav" className="rb-fade-in border-t border-line bg-white px-4 py-2 lg:hidden">
          <ul className="flex flex-col">
            {nav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive(item.href) ? "page" : undefined}
                  className={cn(
                    "block border-b border-line py-2.5 text-[15px]",
                    isActive(item.href) ? "font-medium text-forest" : "text-ink",
                  )}
                >
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/messages" className="block border-b border-line py-2.5 text-[15px] text-ink">
                Messages{unreadMessageCount > 0 ? ` (${unreadMessageCount})` : ""}
              </Link>
            </li>
            {nav.some((item) => item.href === "/profile") ? null : (
              <li>
                <Link href="/profile" className="block border-b border-line py-2.5 text-[15px] text-ink">
                  Profile
                </Link>
              </li>
            )}
            <li>
              <form action="/api/signout" method="post">
                <button type="submit" className="block w-full py-2.5 text-left text-[15px] text-ink">
                  Sign out
                </button>
              </form>
            </li>
          </ul>
        </div>
      ) : null}
    </header>
  );
}
