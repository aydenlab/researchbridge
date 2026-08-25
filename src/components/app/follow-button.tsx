"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/errors";
import { followAction, unfollowAction } from "@/app/(app)/connections/actions";

function Submit({ following }: { following: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant={following ? "secondary" : "primary"} disabled={pending}>
      {pending ? (following ? "Removing" : "Following") : following ? "Following" : "Follow"}
    </Button>
  );
}

export function FollowButton({ userId, following }: { userId: string; following: boolean }) {
  const [state, action] = useActionState<ActionResult | null, FormData>(
    following ? unfollowAction : followAction,
    null,
  );

  return (
    <form action={action} className="inline-flex flex-col items-start gap-1">
      <input type="hidden" name="userId" value={userId} />
      <Submit following={following} />
      {state?.ok === false ? <span className="text-[12px] text-bad">{state.error}</span> : null}
    </form>
  );
}
