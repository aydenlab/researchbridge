import Link from "next/link";
import { Logo } from "@/components/marketing/brand";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-shell px-5 py-16">
      <div className="w-full max-w-md text-center">
        <Logo className="mx-auto h-10 w-auto" />
        <h1 className="mt-6 font-display text-[30px] text-ink" style={{ letterSpacing: "-0.5px" }}>
          That page does not exist
        </h1>
        <p className="mt-3 text-[15px] leading-7 text-muted">
          The link may be out of date, or the position may have been closed by the researcher who posted it.
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/opportunities"
            className="inline-flex h-10 items-center rounded-full bg-ink px-5 text-sm font-medium text-white transition-transform hover:scale-[1.03]"
          >
            Explore opportunities
          </Link>
          <Link
            href="/"
            className="inline-flex h-10 items-center rounded-full border border-line-strong bg-white px-5 text-sm font-medium text-ink hover:bg-cream"
          >
            Go to the homepage
          </Link>
        </div>
      </div>
    </div>
  );
}
