"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/errors";
import { markAllReadAction } from "./actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" size="sm" disabled={pending}>
      {pending ? "Marking" : "Mark all as read"}
    </Button>
  );
}

export function MarkAllRead() {
  const [, action] = useActionState<ActionResult | null, FormData>(markAllReadAction, null);
  return (
    <form action={action}>
      <Submit />
    </form>
  );
}
