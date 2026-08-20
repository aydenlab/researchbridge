"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Plus } from "lucide-react";
import { Input } from "@/components/ui/field";
import type { ActionResult } from "@/lib/errors";
import { addTaxonomyEntryAction, setSkillApprovalAction } from "../actions";

function AddButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-[34px] shrink-0 items-center gap-1 rounded-full bg-ink px-3.5 text-[12.5px] font-medium text-white disabled:opacity-50"
    >
      <Plus className="size-3.5" aria-hidden="true" />
      {pending ? "Adding" : "Add"}
    </button>
  );
}

export function AddTaxonomyForm({ kind }: { kind: "skill" | "field" }) {
  const [state, action] = useActionState<ActionResult | null, FormData>(addTaxonomyEntryAction, null);

  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="kind" value={kind} />
      <div className="flex gap-2">
        <label htmlFor={`add-${kind}`} className="sr-only">
          Add a {kind}
        </label>
        <Input id={`add-${kind}`} name="name" placeholder={kind === "skill" ? "Flow cytometry" : "Sleep science"} className="h-[34px] w-44 py-1 text-[13px]" />
        {kind === "skill" ? (
          <>
            <label htmlFor="add-skill-category" className="sr-only">
              Category
            </label>
            <Input id="add-skill-category" name="category" placeholder="Category" className="h-[34px] w-28 py-1 text-[13px]" />
          </>
        ) : null}
        <AddButton />
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

function ToggleButton({ approved }: { approved: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-7 items-center rounded-full border border-line-strong bg-white px-3 text-[12px] text-ink transition-colors hover:bg-shell disabled:opacity-50"
    >
      {pending ? "Saving" : approved ? "Hide" : "Approve"}
    </button>
  );
}

export function SkillApprovalToggle({ skillId, approved }: { skillId: string; approved: boolean }) {
  const [, action] = useActionState<ActionResult | null, FormData>(setSkillApprovalAction, null);

  return (
    <form action={action}>
      <input type="hidden" name="skillId" value={skillId} />
      <input type="hidden" name="approved" value={approved ? "false" : "true"} />
      <ToggleButton approved={approved} />
    </form>
  );
}
