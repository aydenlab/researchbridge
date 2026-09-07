"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Field, FormError, Textarea } from "@/components/ui/field";
import type { ActionResult } from "@/lib/errors";
import { referStudentAction, withdrawReferralAction } from "../actions";

function Submit({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

function Withdraw() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant="danger" disabled={pending}>
      {pending ? "Withdrawing" : "Withdraw my referral"}
    </Button>
  );
}

export function ReferralControls({
  subjectId,
  subjectName,
  existing,
}: {
  subjectId: string;
  subjectName: string;
  existing: { note: string | null; hasLetter: boolean } | null;
}) {
  const [open, setOpen] = useState(false);
  const [referState, referAction] = useActionState<ActionResult | null, FormData>(referStudentAction, null);
  const [withdrawState, withdrawAction] = useActionState<ActionResult | null, FormData>(withdrawReferralAction, null);

  if (existing && !open) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-[13px] text-muted">You have referred {subjectName}.</p>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            Edit your referral
          </Button>
          <form action={withdrawAction}>
            <input type="hidden" name="subjectId" value={subjectId} />
            <Withdraw />
          </form>
        </div>
        {withdrawState?.ok === false ? <p className="text-[12px] text-bad">{withdrawState.error}</p> : null}
      </div>
    );
  }

  if (!open) {
    return (
      <div className="flex flex-col gap-1.5">
        <Button size="sm" onClick={() => setOpen(true)}>
          Refer {subjectName}
        </Button>
        <p className="text-[12px] leading-5 text-muted">
          Your name appears on their profile as the person vouching. Only do this for somebody you know.
        </p>
      </div>
    );
  }

  return (
    <form action={referAction} className="flex w-full max-w-[420px] flex-col gap-3">
      <input type="hidden" name="subjectId" value={subjectId} />
      <FormError>{referState?.ok === false ? referState.error : null}</FormError>

      <Field
        label="What you would say about them"
        htmlFor="referral-note"
        hint="A sentence or two, shown publicly on their profile with your name."
      >
        <Textarea
          id="referral-note"
          name="note"
          rows={3}
          maxLength={600}
          defaultValue={existing?.note ?? ""}
          placeholder="Worked in my lab for two terms and ran the extraction independently."
        />
      </Field>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="referral-letter" className="text-[13px] font-medium text-ink">
          Reference letter
          <span className="ml-1.5 text-[11.5px] font-normal text-subtle">Optional, PDF</span>
        </label>
        <input
          id="referral-letter"
          name="letter"
          type="file"
          accept="application/pdf"
          className="text-[13px] text-muted file:mr-3 file:rounded-full file:border file:border-line-strong file:bg-white file:px-3.5 file:py-1.5 file:text-[13px] file:text-ink"
        />
        {existing?.hasLetter ? (
          <p className="text-[12px] text-subtle">A letter is already attached. Choosing a new file replaces it.</p>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        <Submit label={existing ? "Save referral" : "Add referral"} pendingLabel="Saving" />
        <Button size="sm" variant="outline" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
