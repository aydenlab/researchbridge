"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { cn } from "@/components/ui/cn";
import type { ActionResult } from "@/lib/errors";
import { setAccountStatusAction, setUserRoleAction } from "../actions";

function StatusButton({ label, value, tone }: { label: string; value: string; tone: string }) {
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

export function AccountControls({ userId, status }: { userId: string; status: string }) {
  const [state, action] = useActionState<ActionResult | null, FormData>(setAccountStatusAction, null);

  return (
    <form action={action} className="flex flex-col gap-1.5">
      <input type="hidden" name="userId" value={userId} />
      <div className="flex flex-wrap gap-1.5">
        {status !== "active" ? (
          <StatusButton label="Activate" value="active" tone="border border-line-strong bg-white text-ink hover:bg-shell" />
        ) : null}
        {status !== "suspended" ? (
          <StatusButton label="Suspend" value="suspended" tone="border border-[#e6d7ae] bg-white text-warn hover:bg-gold-soft" />
        ) : null}
        {status !== "disabled" ? (
          <StatusButton label="Disable" value="disabled" tone="border border-[#e2c4c0] bg-white text-bad hover:bg-[#fbf2f1]" />
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

function RoleButton({ label, value, tone }: { label: string; value: string; tone: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name="role"
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

/**
 * Granting admin rights from here rather than only through ADMIN_EMAILS, which
 * needs a redeploy and access to the deployment to change.
 */
export function RoleControls({ userId, role }: { userId: string; role: string | null }) {
  const [state, action] = useActionState<ActionResult | null, FormData>(setUserRoleAction, null);

  return (
    <form action={action} className="flex flex-col gap-1.5">
      <input type="hidden" name="userId" value={userId} />
      {role === "admin" ? (
        <RoleButton label="Remove admin" value="member" tone="border border-[#e6d7ae] bg-white text-warn hover:bg-gold-soft" />
      ) : (
        <RoleButton label="Make admin" value="admin" tone="border border-line-strong bg-white text-ink hover:bg-shell" />
      )}
      {state?.ok === false ? (
        <p role="alert" className="text-[11.5px] text-bad">
          {state.error}
        </p>
      ) : null}
      {state?.ok ? <p className="text-[11.5px] text-ok">{state.message}</p> : null}
    </form>
  );
}
