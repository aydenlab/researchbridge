"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Field, FormError, Select, Textarea } from "@/components/ui/field";
import type { ActionResult } from "@/lib/errors";
import { saveReviewAction } from "./actions";

const RATINGS = [
  { value: "5", label: "5 — I would work with them again without hesitation" },
  { value: "4", label: "4 — A good experience" },
  { value: "3", label: "3 — Mixed, but it worked out" },
  { value: "2", label: "2 — Difficult" },
  { value: "1", label: "1 — I would not repeat it" },
];

function SaveButton({ existing }: { existing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "Saving" : existing ? "Update review" : "Leave review"}
    </Button>
  );
}

export function ReviewForm({
  applicationId,
  direction,
  counterpartName,
  existing,
}: {
  applicationId: string;
  direction: "researcher_to_student" | "student_to_researcher";
  counterpartName: string;
  existing: { rating: number; comment: string | null } | null;
}) {
  const [state, action] = useActionState<ActionResult | null, FormData>(saveReviewAction, null);

  return (
    <form action={action} className="mt-3 flex flex-col gap-3 border-t border-line pt-3">
      <input type="hidden" name="applicationId" value={applicationId} />
      <input type="hidden" name="direction" value={direction} />
      <FormError>{state?.ok === false ? state.error : null}</FormError>
      {state?.ok ? <p className="text-[12.5px] text-ok">{state.message}</p> : null}

      <Field label={`How was working with ${counterpartName}?`} htmlFor={`rating-${applicationId}`} required>
        <Select id={`rating-${applicationId}`} name="rating" defaultValue={existing ? String(existing.rating) : ""}>
          <option value="" disabled>
            Choose a rating
          </option>
          {RATINGS.map((rating) => (
            <option key={rating.value} value={rating.value}>
              {rating.label}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        label="Anything you would tell the next person"
        htmlFor={`comment-${applicationId}`}
        hint="Optional. This is shown on their profile, with your name."
      >
        <Textarea
          id={`comment-${applicationId}`}
          name="comment"
          rows={3}
          maxLength={2000}
          defaultValue={existing?.comment ?? ""}
        />
      </Field>

      <div>
        <SaveButton existing={Boolean(existing)} />
      </div>
    </form>
  );
}
