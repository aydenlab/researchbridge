"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { ActionResult } from "@/lib/errors";
import { changeOpportunityStatusAction } from "./actions";

const OPTIONS: Record<string, { value: string; label: string; note: string }[]> = {
  published: [
    { value: "closed", label: "Close position", note: "Stops new applications. Applicants are told." },
    { value: "unpublished", label: "Unpublish", note: "Hides the listing while you edit it." },
  ],
  closed: [
    { value: "published", label: "Reopen", note: "Makes the listing visible again." },
    { value: "archived", label: "Archive", note: "Moves it out of the way. Applications are preserved." },
  ],
  unpublished: [
    { value: "published", label: "Publish again", note: "Makes the listing visible again." },
    { value: "closed", label: "Close position", note: "Stops new applications." },
  ],
  archived: [],
};

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-8 items-center rounded-full border border-line-strong bg-white px-3.5 text-[12.5px] text-ink transition-colors hover:bg-shell disabled:opacity-50"
    >
      {pending ? "Working" : label}
    </button>
  );
}

export function StatusControls({ opportunityId, status }: { opportunityId: string; status: string }) {
  const [state, action] = useActionState<ActionResult | null, FormData>(changeOpportunityStatusAction, null);
  const options = OPTIONS[status] ?? [];

  if (options.length === 0) {
    return <p className="text-[12.5px] text-muted">This position is archived. Its applications and history are preserved.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {options.map((option) => (
          <form key={option.value} action={action}>
            <input type="hidden" name="opportunityId" value={opportunityId} />
            <input type="hidden" name="status" value={option.value} />
            <Submit label={option.label} />
          </form>
        ))}
      </div>
      <p className="text-[12px] leading-5 text-subtle">{options.map((option) => `${option.label}: ${option.note}`).join(" ")}</p>
      {state?.ok === false ? (
        <p role="alert" className="text-[12.5px] text-bad">
          {state.error}
        </p>
      ) : null}
      {state?.ok ? <p className="text-[12.5px] text-ok">{state.message}</p> : null}
    </div>
  );
}
