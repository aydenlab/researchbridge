"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(JSON.stringify({ level: "error", event: "client_boundary", digest: error.digest }));
  }, [error]);

  return (
    <div className="flex min-h-[70vh] items-center justify-center bg-shell px-5 py-16">
      <div className="w-full max-w-md text-center">
        <h1 className="font-display text-[28px] text-ink" style={{ letterSpacing: "-0.5px" }}>
          Something on our side failed
        </h1>
        <p className="mt-3 text-[15px] leading-7 text-muted">
          Any work you had saved is still saved. Try again, and if it keeps happening write to
          hello@myresearchbridge.com.
        </p>
        {error.digest ? <p className="mt-3 font-mono text-[12px] text-subtle">Reference {error.digest}</p> : null}
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-10 items-center rounded-full bg-ink px-5 text-sm font-medium text-white transition-transform hover:scale-[1.03]"
          >
            Try again
          </button>
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
