"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Field, FormError, FormNote, Textarea } from "@/components/ui/field";
import type { ActionResult } from "@/lib/errors";
import { respondToReferenceAction } from "./actions";

function Buttons() {
  const { pending } = useFormStatus();
  return (
    <div className="flex flex-wrap gap-2">
      <Button type="submit" name="decision" value="approved" size="lg" disabled={pending}>
        {pending ? "Sending" : "Yes, I confirm"}
      </Button>
      <Button type="submit" name="decision" value="declined" size="lg" variant="danger" disabled={pending}>
        Decline
      </Button>
    </div>
  );
}

export function ReferenceForm({ token }: { token: string }) {
  const [state, action] = useActionState<ActionResult | null, FormData>(respondToReferenceAction, null);

  if (state?.ok) {
    return (
      <div className="rounded-[10px] border border-line bg-shell px-4 py-4">
        <p className="text-[14.5px] text-ink">{state.message}</p>
        <p className="mt-1.5 text-[13px] text-muted">
          Thank you. We have told them what you decided. You can close this page.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="mt-6 flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      <FormError>{state?.ok === false ? state.error : null}</FormError>

      <Field label="Anything you want to add" htmlFor="note" hint="Optional. The applicant will not see this note.">
        <Textarea id="note" name="note" rows={3} maxLength={600} />
      </Field>

      <Buttons />

      <FormNote>
        Confirming says only that you are willing to be named as a reference. It is not a recommendation letter and
        you are not scoring anyone.
      </FormNote>
    </form>
  );
}
