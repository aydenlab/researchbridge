"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/field";
import type { ActionResult } from "@/lib/errors";
import { createDraftAction } from "../actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending}>
      {pending ? "Creating draft" : "Start a draft"}
    </Button>
  );
}

export function CreateDraftButton() {
  const [state, action] = useActionState<ActionResult | null, FormData>(createDraftAction, null);
  return (
    <form action={action} className="flex flex-col gap-3">
      <FormError>{state?.ok === false ? state.error : null}</FormError>
      <Submit />
    </form>
  );
}
