"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Compass, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/field";
import type { ActionResult } from "@/lib/errors";
import { chooseRoleAction } from "./actions";

const OPTIONS = [
  {
    value: "student",
    Icon: Compass,
    title: "Find research opportunities",
    body: "Build one profile, browse positions that are actively recruiting, and apply to the projects you want.",
  },
  {
    value: "researcher",
    Icon: Users,
    title: "Recruit for a research project",
    body: "Post a position, set the criteria that matter for your project, and review structured applications.",
  },
];

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending}>
      {pending ? "Saving" : "Continue"}
    </Button>
  );
}

export function RoleChoice({ email, institutionName }: { email: string; institutionName: string | null }) {
  const [state, action] = useActionState<ActionResult | null, FormData>(chooseRoleAction, null);

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-14 sm:px-6">
      <p className="text-[12px] font-medium text-subtle">Step 1 of 2</p>
      <h1 className="mt-3 font-display text-[32px] text-ink" style={{ letterSpacing: "-0.6px", lineHeight: 1.15 }}>
        How will you use ResearchBridge?
      </h1>
      <p className="mt-3 text-[15px] leading-7 text-muted">
        Signed in as {email}
        {institutionName ? ` at ${institutionName}` : ""}. You can only pick one, so choose the one that describes what
        you are here to do.
      </p>

      <form action={action} className="mt-8 flex flex-col gap-4">
        <FormError>{state?.ok === false ? state.error : null}</FormError>

        <fieldset className="flex flex-col gap-3">
          <legend className="sr-only">Choose how you will use ResearchBridge</legend>
          {OPTIONS.map((option) => (
            <label
              key={option.value}
              htmlFor={`role-${option.value}`}
              className="flex cursor-pointer gap-4 rounded-[12px] border border-line bg-white p-5 transition-colors hover:border-forest/45 has-[:checked]:border-forest has-[:checked]:bg-moss/40"
            >
              <input
                id={`role-${option.value}`}
                type="radio"
                name="role"
                value={option.value}
                required
                className="mt-1 size-4 shrink-0 accent-[#1d4436]"
              />
              <span className="min-w-0">
                <span className="flex items-center gap-2">
                  <option.Icon className="size-4 text-forest" aria-hidden="true" />
                  <span className="font-display text-[19px] text-ink">{option.title}</span>
                </span>
                <span className="mt-1.5 block text-[14px] leading-6 text-muted">{option.body}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <div className="mt-2">
          <Submit />
        </div>
      </form>
    </div>
  );
}
