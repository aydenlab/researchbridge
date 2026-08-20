"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { cn } from "@/components/ui/cn";
import { Input } from "@/components/ui/field";
import type { ActionResult } from "@/lib/errors";
import { reviewResearcherAction } from "../actions";

const DECISIONS = [
  { value: "verified", label: "Approve", tone: "bg-ink text-white hover:bg-ink/85" },
  { value: "needs_review", label: "Request clarification", tone: "border border-line-strong bg-white text-ink hover:bg-shell" },
  { value: "rejected", label: "Reject", tone: "border border-[#e2c4c0] bg-white text-bad hover:bg-[#fbf2f1]" },
];

function DecisionButtons() {
  const { pending } = useFormStatus();
  return (
    <div className="flex flex-wrap gap-2">
      {DECISIONS.map((decision) => (
        <button
          key={decision.value}
          type="submit"
          name="decision"
          value={decision.value}
          disabled={pending}
          className={cn(
            "inline-flex h-8 items-center rounded-full px-3.5 text-[12.5px] font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
            decision.tone,
          )}
        >
          {pending ? "Saving" : decision.label}
        </button>
      ))}
    </div>
  );
}

export function ReviewForm({ researcherId, currentNotes }: { researcherId: string; currentNotes: string | null }) {
  const [state, action] = useActionState<ActionResult | null, FormData>(reviewResearcherAction, null);

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="researcherId" value={researcherId} />

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`notes-${researcherId}`} className="text-[12.5px] font-medium text-ink">
          Note to the researcher
        </label>
        <Input
          id={`notes-${researcherId}`}
          name="notes"
          defaultValue={currentNotes ?? ""}
          placeholder="Optional. Sent with the decision."
        />
      </div>

      <DecisionButtons />

      {state?.ok === false ? (
        <p role="alert" className="text-[12.5px] text-bad">
          {state.error}
        </p>
      ) : null}
      {state?.ok ? <p className="text-[12.5px] text-ok">{state.message}</p> : null}
    </form>
  );
}
