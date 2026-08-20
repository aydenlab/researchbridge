"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { RadioRow } from "@/components/ui/field";
import type { ActionResult } from "@/lib/errors";
import { reportOutcomeAction, withdrawApplicationAction } from "../actions";

function Pending({ label, pendingLabel, variant = "primary" }: { label: string; pendingLabel: string; variant?: "primary" | "danger" }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} disabled={pending} size={variant === "danger" ? "sm" : "md"}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

export function WithdrawForm({ applicationId }: { applicationId: string }) {
  const [state, action] = useActionState<ActionResult | null, FormData>(withdrawApplicationAction, null);

  if (state?.ok) {
    return <p className="text-[12.5px] text-muted">This application has been withdrawn.</p>;
  }

  return (
    <form action={action}>
      <input type="hidden" name="applicationId" value={applicationId} />
      <Pending label="Withdraw application" pendingLabel="Withdrawing" variant="danger" />
      <p className="mt-2 text-[12px] leading-5 text-subtle">
        The researcher is told that you withdrew. This cannot be undone.
      </p>
      {state?.ok === false ? (
        <p role="alert" className="mt-2 text-[12.5px] text-bad">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

export function OutcomeForm({ applicationId }: { applicationId: string }) {
  const [state, action] = useActionState<ActionResult | null, FormData>(reportOutcomeAction, null);

  if (state?.ok) {
    return <p className="mt-4 text-[13.5px] text-ok">{state.message ?? "Recorded. Thank you."}</p>;
  }

  return (
    <form action={action} className="mt-4 flex flex-col gap-3">
      <input type="hidden" name="applicationId" value={applicationId} />
      <fieldset className="grid gap-2 sm:grid-cols-2">
        <legend className="sr-only">Did this application result in a research opportunity?</legend>
        <RadioRow id="outcome-yes" name="outcome" value="yes" label="Yes" />
        <RadioRow id="outcome-progress" name="outcome" value="in_progress" label="Still in progress" />
        <RadioRow id="outcome-no" name="outcome" value="no" label="No" />
        <RadioRow id="outcome-private" name="outcome" value="prefer_not_to_say" label="Prefer not to say" />
      </fieldset>

      <label className="flex cursor-pointer items-start gap-2.5 rounded-[8px] border border-line bg-white px-3 py-2.5">
        <input type="checkbox" name="wouldUseAgain" value="true" className="mt-0.5 size-4 accent-[#1d4436]" />
        <span className="text-[13.5px] text-ink">I would use ResearchBridge again</span>
      </label>

      {state?.ok === false ? (
        <p role="alert" className="text-[12.5px] text-bad">
          {state.error}
        </p>
      ) : null}

      <div>
        <Pending label="Submit answer" pendingLabel="Saving" />
      </div>
    </form>
  );
}
