"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { MultiSelectGrid } from "@/components/app/inputs";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input, RadioRow, Textarea } from "@/components/ui/field";
import type { ActionResult } from "@/lib/errors";
import { REVIEW_TASK_LABELS, REVIEW_TASK_ORDER } from "@/lib/labels";
import { createReviewPostingAction, updateReviewPostingAction } from "../actions";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Posting" : label}
    </Button>
  );
}

export function ReviewPostingForm({
  opportunityId,
  draft,
}: {
  opportunityId?: string;
  draft?: { title: string; summary: string; authorshipOffered: boolean; reviewTasks: string[] };
}) {
  const [state, action] = useActionState<ActionResult | null, FormData>(
    opportunityId ? updateReviewPostingAction : createReviewPostingAction,
    null,
  );
  const errors = state?.ok === false ? state.fieldErrors : undefined;

  return (
    <form action={action} className="flex flex-col gap-6">
      {opportunityId ? <input type="hidden" name="opportunityId" value={opportunityId} /> : null}
      <FormError>{state?.ok === false ? state.error : null}</FormError>

      <Field
        label="Title"
        htmlFor="title"
        required
        error={errors?.title?.[0]}
        hint="Name the review. Students scan this list quickly, so say what it is about."
      >
        <Input
          id="title"
          name="title"
          defaultValue={draft?.title ?? ""}
          placeholder="Scoping review of remote cardiac rehabilitation trials"
          required
        />
      </Field>

      <Field
        label="Short summary of the review"
        htmlFor="summary"
        required
        error={errors?.summary?.[0]}
        hint="A few sentences. The question, roughly where it is up to, and the rough time commitment."
      >
        <Textarea id="summary" name="summary" rows={5} defaultValue={draft?.summary ?? ""} maxLength={1200} required />
      </Field>

      <fieldset>
        <legend className="mb-1 text-[13px] font-medium text-ink">Authorship</legend>
        <p className="mb-2 text-[12.5px] leading-5 text-muted">
          Answer honestly. This is the single thing students look at first, and a wrong yes is worse than an honest no.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <RadioRow
            id="authorship-yes"
            name="authorshipOffered"
            value="true"
            label="Yes, contributors will be named as authors"
            defaultChecked={draft?.authorshipOffered === true}
          />
          <RadioRow
            id="authorship-no"
            name="authorshipOffered"
            value="false"
            label="No authorship on this one"
            defaultChecked={draft ? draft.authorshipOffered === false : true}
          />
        </div>
      </fieldset>

      <MultiSelectGrid
        name="reviewTasks"
        legend="What do you need help with?"
        hint="Choose everything you would hand over."
        options={REVIEW_TASK_ORDER.map((value) => ({ value, label: REVIEW_TASK_LABELS[value] }))}
        initial={draft?.reviewTasks ?? []}
        error={errors?.reviewTasks?.[0]}
        selectAllLabel="All of it"
        columns={2}
      />

      <div className="flex items-center gap-3 border-t border-line pt-5">
        <Submit label={opportunityId ? "Save changes" : "Post the review"} />
        <p className="text-[12.5px] text-muted">
          {opportunityId ? "Changes are live immediately." : "It goes live immediately. You can close it at any time."}
        </p>
      </div>
    </form>
  );
}
