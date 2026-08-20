"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { cn } from "@/components/ui/cn";
import type { ActionResult } from "@/lib/errors";
import { toggleFeatureFlagAction } from "../actions";

function Toggle({ enabled }: { enabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-pressed={enabled}
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-2 rounded-full border px-3.5 text-[12.5px] font-medium transition-colors disabled:opacity-50",
        enabled ? "border-[#c2dccc] bg-moss text-ok" : "border-line-strong bg-white text-muted",
      )}
    >
      {pending ? "Saving" : enabled ? "Enabled" : "Disabled"}
    </button>
  );
}

export function FlagToggle({ flagKey, enabled }: { flagKey: string; enabled: boolean }) {
  const [, action] = useActionState<ActionResult | null, FormData>(toggleFeatureFlagAction, null);

  return (
    <form action={action}>
      <input type="hidden" name="key" value={flagKey} />
      <input type="hidden" name="enabled" value={enabled ? "false" : "true"} />
      <Toggle enabled={enabled} />
    </form>
  );
}
