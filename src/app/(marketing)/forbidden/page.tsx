import type { Metadata } from "next";
import Link from "next/link";
import { ShieldOff } from "lucide-react";
import { currentUser } from "@/lib/auth/permissions";

export const metadata: Metadata = {
  title: "No access",
  robots: { index: false, follow: false },
};

export default async function ForbiddenPage() {
  const user = await currentUser();
  const home = user?.role === "admin" ? "/admin" : user?.role === "researcher" ? "/researcher" : user ? "/dashboard" : "/";

  return (
    <div className="mx-auto flex max-w-[640px] flex-col items-start px-5 py-20 sm:px-6 sm:py-28">
      <span className="inline-flex size-10 items-center justify-center rounded-full border border-line-strong bg-white text-muted">
        <ShieldOff className="size-4" aria-hidden="true" />
      </span>

      <h1 className="mt-6 font-display text-[30px] text-ink" style={{ letterSpacing: "-0.5px" }}>
        This page is not available to your account
      </h1>

      <p className="mt-3 text-[15px] leading-7 text-muted">
        {user
          ? "Your account does not have access to this area. Students, researchers, and ResearchBridge administrators each see a different part of the product, and access is checked on the server rather than by hiding links."
          : "You need to be signed in with the right kind of account to open this page."}
      </p>

      <p className="mt-3 text-[14px] leading-7 text-muted">
        If you think this is wrong, write to{" "}
        <a href="mailto:hello@myresearchbridge.com" className="underline decoration-line-strong underline-offset-4 hover:text-ink">
          hello@myresearchbridge.com
        </a>{" "}
        from the address on your account.
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href={home}
          className="inline-flex h-10 items-center rounded-full bg-ink px-5 text-sm font-medium text-white transition-transform hover:scale-[1.03]"
        >
          {user ? "Back to your home page" : "Go to the homepage"}
        </Link>
        <Link
          href="/opportunities"
          className="inline-flex h-10 items-center rounded-full border border-line-strong bg-white px-5 text-sm font-medium text-ink hover:bg-cream"
        >
          Browse open research
        </Link>
      </div>
    </div>
  );
}
