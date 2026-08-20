"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/errors";
import { startApplicationAction, toggleSavedAction } from "@/app/(app)/opportunities/actions";

function SaveButton({ saved }: { saved: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" size="lg" disabled={pending}>
      {saved ? <BookmarkCheck className="size-4" aria-hidden="true" /> : <Bookmark className="size-4" aria-hidden="true" />}
      {pending ? "Saving" : saved ? "Saved" : "Save opportunity"}
    </Button>
  );
}

function ApplyButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending}>
      {pending ? "Opening application" : label}
    </Button>
  );
}

export function OpportunityActions({
  opportunityId,
  slug,
  saved,
  signedIn,
  isStudent,
  applicationId,
  applicationStatus,
  acceptingApplications,
  closedReason,
}: {
  opportunityId: string;
  slug: string;
  saved: boolean;
  signedIn: boolean;
  isStudent: boolean;
  applicationId: string | null;
  applicationStatus: string | null;
  acceptingApplications: boolean;
  closedReason: string | null;
}) {
  const [saveState, saveAction] = useActionState<ActionResult | null, FormData>(toggleSavedAction, null);
  const [applyState, applyAction] = useActionState<ActionResult | null, FormData>(startApplicationAction, null);

  if (!signedIn) {
    return (
      <div className="flex flex-col gap-2.5">
        <Link
          href="/signin"
          className="inline-flex h-11 items-center justify-center rounded-full bg-ink px-6 text-[15px] font-medium text-white transition-transform hover:scale-[1.03]"
        >
          Sign in to apply
        </Link>
        <p className="text-[12.5px] leading-5 text-muted">
          Students in the pilot sign in with an institutional email address. There is no password to create.
        </p>
      </div>
    );
  }

  if (!isStudent) {
    return (
      <p className="rounded-[8px] border border-line bg-shell px-3 py-2.5 text-[13px] leading-6 text-muted">
        You are signed in with a researcher or administrator account, so applying is not available here.
      </p>
    );
  }

  if (applicationId && applicationStatus && applicationStatus !== "draft") {
    return (
      <div className="flex flex-col gap-2.5">
        <Link
          href={`/applications/${applicationId}`}
          className="inline-flex h-11 items-center justify-center rounded-full border border-line-strong bg-white px-6 text-[15px] font-medium text-ink transition-colors hover:bg-shell"
        >
          View your application
        </Link>
        <form action={saveAction}>
          <input type="hidden" name="opportunityId" value={opportunityId} />
          <input type="hidden" name="slug" value={slug} />
          <SaveButton saved={saved} />
        </form>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      {acceptingApplications ? (
        <form action={applyAction}>
          <input type="hidden" name="opportunityId" value={opportunityId} />
          <ApplyButton label={applicationId ? "Continue your application" : "Apply to this project"} />
        </form>
      ) : (
        <p className="rounded-[8px] border border-line bg-shell px-3 py-2.5 text-[13px] leading-6 text-muted">
          {closedReason ?? "This position is not accepting applications right now."}
        </p>
      )}

      <form action={saveAction}>
        <input type="hidden" name="opportunityId" value={opportunityId} />
        <input type="hidden" name="slug" value={slug} />
        <SaveButton saved={saveState?.ok ? !saved : saved} />
      </form>

      {applyState?.ok === false ? (
        <p role="alert" className="text-[12.5px] text-bad">
          {applyState.error}
        </p>
      ) : null}
      {saveState?.ok === false ? (
        <p role="alert" className="text-[12.5px] text-bad">
          {saveState.error}
        </p>
      ) : null}
    </div>
  );
}
