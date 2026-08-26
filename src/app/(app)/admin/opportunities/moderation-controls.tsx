"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { cn } from "@/components/ui/cn";
import { Input } from "@/components/ui/field";
import type { ActionResult } from "@/lib/errors";
import { moderateOpportunityAction } from "../actions";

function ModButton({ label, value, tone }: { label: string; value: string; tone: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name="status"
      value={value}
      disabled={pending}
      className={cn(
        "inline-flex h-7 items-center rounded-full px-3 text-[12px] transition-colors disabled:pointer-events-none disabled:opacity-50",
        tone,
      )}
    >
      {label}
    </button>
  );
}

export function ModerationControls({ opportunityId, status }: { opportunityId: string; status: string }) {
  const [state, action] = useActionState<ActionResult | null, FormData>(moderateOpportunityAction, null);
  const [showReason, setShowReason] = useState(false);

  return (
    <form action={action} className="flex flex-col gap-1.5">
      <input type="hidden" name="opportunityId" value={opportunityId} />

      {showReason ? (
        <div className="mb-1">
          <label htmlFor={`reason-${opportunityId}`} className="sr-only">
            Reason sent to the researcher
          </label>
          <Input
            id={`reason-${opportunityId}`}
            name="reason"
            placeholder="Reason sent to the researcher"
            className="text-[12px]"
          />
        </div>
      ) : null}

      <div className="flex flex-wrap gap-1.5">
        {status !== "published" && status !== "archived" ? (
          <ModButton
            label={status === "pending_review" ? "Approve" : "Publish"}
            value="published"
            tone={
              status === "pending_review"
                ? "border border-[#c2dccc] bg-moss text-ok hover:bg-white"
                : "border border-line-strong bg-white text-ink hover:bg-shell"
            }
          />
        ) : null}
        {status === "published" ? (
          <ModButton label="Unpublish" value="unpublished" tone="border border-[#e6d7ae] bg-white text-warn hover:bg-gold-soft" />
        ) : null}
        {status !== "closed" && status !== "archived" ? (
          <ModButton label="Close" value="closed" tone="border border-line-strong bg-white text-ink hover:bg-shell" />
        ) : null}
        {status !== "archived" ? (
          <ModButton label="Archive" value="archived" tone="border border-line-strong bg-white text-muted hover:bg-shell" />
        ) : null}
        {!showReason ? (
          <button
            type="button"
            onClick={() => setShowReason(true)}
            className="inline-flex h-7 items-center rounded-full px-2 text-[12px] text-muted underline decoration-line-strong underline-offset-4 hover:text-ink"
          >
            Add reason
          </button>
        ) : null}
      </div>

      {state?.ok === false ? (
        <p role="alert" className="text-[11.5px] text-bad">
          {state.error}
        </p>
      ) : null}
      {state?.ok ? <p className="text-[11.5px] text-ok">{state.message}</p> : null}
    </form>
  );
}
