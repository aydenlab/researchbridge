"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, FormError, FormNote, Input } from "@/components/ui/field";
import type { ActionResult } from "@/lib/errors";
import { addReferenceAction, removeReferenceAction } from "../reference-actions";

export type ReferenceRow = {
  id: string;
  refereeEmail: string;
  refereeName: string | null;
  relationship: string | null;
  status: "pending" | "approved" | "declined";
  respondedAt: Date | null;
};

const STATUS_TONE = { approved: "ok", pending: "warn", declined: "neutral" } as const;
const STATUS_LABEL = { approved: "Confirmed", pending: "Waiting", declined: "Declined" } as const;

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

export function ReferenceSection({
  applicationId,
  references,
  editable,
  max,
}: {
  applicationId: string;
  references: ReferenceRow[];
  editable: boolean;
  max: number;
}) {
  const [addState, addAction] = useActionState<ActionResult | null, FormData>(addReferenceAction, null);
  const [, removeAction] = useActionState<ActionResult | null, FormData>(removeReferenceAction, null);
  const atLimit = references.length >= max;

  return (
    <section className="mt-6 rounded-[12px] border border-line bg-white p-5">
      <h2 className="font-display text-[19px] text-ink" style={{ letterSpacing: "-0.4px" }}>
        References
      </h2>
      <p className="mt-2 text-[13.5px] leading-6 text-muted">
        If someone referred you, name them here. We email that person and ask them to confirm. A reference only counts
        once they have confirmed it, so nobody can be listed without agreeing.
      </p>

      {references.length > 0 ? (
        <ul className="mt-4">
          {references.map((reference) => (
            <li key={reference.id} className="flex items-center justify-between gap-4 border-b border-line py-3 last:border-b-0">
              <div className="min-w-0">
                <p className="text-[14px] text-ink">{reference.refereeName || reference.refereeEmail}</p>
                <p className="mt-0.5 truncate text-[12.5px] text-subtle">
                  {[reference.refereeName ? reference.refereeEmail : null, reference.relationship]
                    .filter(Boolean)
                    .join(", ") || "No relationship given"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge tone={STATUS_TONE[reference.status]}>{STATUS_LABEL[reference.status]}</Badge>
                {editable && reference.status === "pending" ? (
                  <form action={removeAction}>
                    <input type="hidden" name="referenceId" value={reference.id} />
                    <RemoveButton />
                  </form>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-[13.5px] text-muted">You have not named anyone yet.</p>
      )}

      {editable && !atLimit ? (
        <form action={addAction} className="mt-5 flex flex-col gap-3 border-t border-line pt-5">
          <input type="hidden" name="applicationId" value={applicationId} />
          <FormError>{addState?.ok === false ? addState.error : null}</FormError>

          <Field
            label="Their email address"
            htmlFor="refereeEmail"
            required
            hint="We send the confirmation request straight to this address."
            error={addState?.ok === false ? addState.fieldErrors?.refereeEmail?.[0] : undefined}
          >
            <Input id="refereeEmail" name="refereeEmail" type="email" inputMode="email" required />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Their name" htmlFor="refereeName" hint="Optional.">
              <Input id="refereeName" name="refereeName" type="text" maxLength={120} />
            </Field>
            <Field label="How they know you" htmlFor="relationship" hint="Optional. For example, course instructor.">
              <Input id="relationship" name="relationship" type="text" maxLength={160} />
            </Field>
          </div>

          <div>
            <AddButton />
          </div>
        </form>
      ) : null}

      {editable && atLimit ? (
        <div className="mt-4">
          <FormNote>You have named the maximum of {max} references for this application.</FormNote>
        </div>
      ) : null}
    </section>
  );
}
