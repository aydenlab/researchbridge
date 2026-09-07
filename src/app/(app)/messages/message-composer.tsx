"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { FormError, Textarea } from "@/components/ui/field";
import type { ActionResult } from "@/lib/errors";
import { sendMessageAction } from "./actions";

function Send() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Sending" : "Send"}
    </Button>
  );
}

export function MessageComposer({ recipientId, recipientName }: { recipientId: string; recipientName: string }) {
  const [state, action] = useActionState<ActionResult | null, FormData>(sendMessageAction, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-2.5">
      <input type="hidden" name="recipientId" value={recipientId} />
      <FormError>{state?.ok === false ? state.error : null}</FormError>

      <label htmlFor="message-body" className="sr-only">
        Message to {recipientName}
      </label>
      <Textarea
        id="message-body"
        name="body"
        rows={3}
        maxLength={4000}
        required
        placeholder={`Write to ${recipientName}`}
      />
      <div className="flex items-center justify-between gap-3">
        <p className="text-[12px] text-subtle">Messages are not anonymous and are kept with your account.</p>
        <Send />
      </div>
    </form>
  );
}
