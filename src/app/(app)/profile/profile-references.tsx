"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FormError, FormNote, Input } from "@/components/ui/field";
import type { ActionResult } from "@/lib/errors";
import { addProfileReferenceAction, removeProfileReferenceAction } from "./reference-actions";

export type ProfileReferenceRow = {
  id: string;
  refereeEmail: string;
  refereeName: string | null;
  relationship: string | null;
  status: "pending" | "approved" | "declined";
};

const TONE = { approved: "ok", pending: "warn", declined: "bad" } as const;
const LABEL = { approved: "Confirmed", pending: "Waiting on them", declined: "Declined" } as const;

function AddButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "Sending" : "Send request"}
    </Button>
  );
}

function RemoveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant="ghost" disabled={pending}>
      {pending ? "Removing" : "Remove"}
    </Button>
  );
}

export function ProfileReferences({ references, max }: { references: ProfileReferenceRow[]; max: number }) {
  const [addState, addAction] = useActionState<ActionResult | null, FormData>(addProfileReferenceAction, null);
  const [removeState, removeAction] = useActionState<ActionResult | null, FormData>(
    removeProfileReferenceAction,
    null,
  );
  const atLimit = references.length >= max;
  const confirmed = references.filter((reference) => reference.status === "approved").length;

  return (
    <section id="references" className="rounded-[12px] border border-line bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
        <h2 className="font-display text-[17px] text-ink">References</h2>
        {references.length > 0 ? (
          <span className="text-[12.5px] text-subtle">
            {confirmed} of {references.length} confirmed
          </span>
        ) : null}
      </div>

      <div className="px-5 py-4">
        <p className="text-[13.5px] leading-6 text-muted">
          Ask someone who knows your work to vouch for you once. We email them, and it only counts once they confirm.
          A confirmed reference shows on your profile and applies to every position you apply to, so you never have to
          ask again per application.
        </p>

        <FormError>{removeState?.ok === false ? removeState.error : null}</FormError>

        {references.length > 0 ? (
          <ul className="mt-4">
            {references.map((reference) => (
              <li
                key={reference.id}
                className="flex items-center justify-between gap-4 border-b border-line py-3 last:border-b-0"
              >
                <div className="min-w-0">
                  <p className="text-[14px] text-ink">{reference.refereeName || reference.refereeEmail}</p>
                  <p className="mt-0.5 truncate text-[12.5px] text-subtle">
                    {[reference.refereeName ? reference.refereeEmail : null, reference.relationship]
                      .filter(Boolean)
                      .join(", ") || "No relationship given"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge tone={TONE[reference.status]}>{LABEL[reference.status]}</Badge>
                  <form action={removeAction}>
                    <input type="hidden" name="referenceId" value={reference.id} />
                    <RemoveButton />
                  </form>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-[13.5px] text-muted">You have not asked anyone yet.</p>
        )}

        {atLimit ? (
          <div className="mt-4">
            <FormNote>You have listed the maximum of {max} references.</FormNote>
          </div>
        ) : (
          <form action={addAction} className="mt-5 flex flex-col gap-3 border-t border-line pt-5">
            <FormError>{addState?.ok === false ? addState.error : null}</FormError>

            <Field
              label="Their email address"
              htmlFor="profileRefereeEmail"
              required
              hint="We send the confirmation request straight to this address."
              error={addState?.ok === false ? addState.fieldErrors?.refereeEmail?.[0] : undefined}
            >
              <Input id="profileRefereeEmail" name="refereeEmail" type="email" inputMode="email" required />
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Their name" htmlFor="profileRefereeName" hint="Optional.">
                <Input id="profileRefereeName" name="refereeName" type="text" maxLength={120} />
              </Field>
              <Field
                label="How they know you"
                htmlFor="profileRelationship"
                hint="Optional. For example, thesis supervisor."
              >
                <Input id="profileRelationship" name="relationship" type="text" maxLength={160} />
              </Field>
            </div>

            <div>
              <AddButton />
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
