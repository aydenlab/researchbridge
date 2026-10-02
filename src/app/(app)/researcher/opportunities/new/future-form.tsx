"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { ResearchAreaPicker, type PickerField } from "@/components/app/research-area-picker";
import { Badge, Tag } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field, FormError, FormNote, Input, Textarea } from "@/components/ui/field";
import type { FormValues, ResubmitResult } from "@/lib/action-utils";
import {
  buildFutureOpportunity,
  FUTURE_MAX_AREAS,
  FUTURE_OPPORTUNITY_LABEL,
  FUTURE_OPPORTUNITY_NOTICE,
} from "@/lib/future-opportunity";
import { createFutureOpportunityAction } from "../actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending}>
      {pending ? "Creating your posting" : "Create my Future Research Opportunity"}
    </Button>
  );
}

type PreviewInput = { names: string[]; department: string; note: string };

export type FutureResearcher = {
  name: string;
  title: string | null;
  labName: string | null;
  biography: string | null;
  recruitingNeeds: string | null;
};

/**
 * Everything on this posting is written from the researcher's profile. The form
 * only confirms the research areas students are matched on, the department,
 * and an optional note, and the preview beside it shows exactly what students
 * will read as those change.
 */
export function FutureOpportunityForm({
  fields,
  disciplines,
  areaIds,
  areaOther,
  department,
  researcher,
  verified,
}: {
  fields: PickerField[];
  disciplines: string[];
  /** The research areas already on the researcher's profile. */
  areaIds: string[];
  areaOther: string;
  department: string;
  researcher: FutureResearcher;
  verified: boolean;
}) {
  const [state, action] = useActionState<ResubmitResult | null, FormData>(createFutureOpportunityAction, null);
  const fieldErrors = state?.ok === false ? state.fieldErrors : undefined;
  const submitted: FormValues = (state?.ok === false ? state.values : undefined) ?? {};

  // Remounting on a refusal puts the submitted values back, the same way the
  // one-page form does, since React empties the form when the action returns.
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (state?.ok === false) setAttempt((count) => count + 1);
  }, [state]);

  const text = (name: string, fallback = "") => submitted[name]?.[0] ?? fallback;
  const initialAreaIds = submitted.researchFieldIds ?? areaIds.slice(0, FUTURE_MAX_AREAS);
  const initialOther = text("researchAreaOther", areaOther);

  const namesById = useRef(new Map(fields.map((field) => [field.id, field.name])));
  const formRef = useRef<HTMLFormElement>(null);

  const readForm = (form: HTMLFormElement): PreviewInput => {
    const data = new FormData(form);
    const names = data
      .getAll("researchFieldIds")
      .map((id) => namesById.current.get(String(id)))
      .filter((name): name is string => Boolean(name));
    const other = String(data.get("researchAreaOther") ?? "").trim();
    if (data.get("researchAreaOtherSelected") && other) names.push(other);
    return { names, department: String(data.get("department") ?? ""), note: String(data.get("note") ?? "") };
  };

  const [preview, setPreview] = useState<PreviewInput>(() => ({
    names: initialAreaIds.map((id) => namesById.current.get(id)).filter((name): name is string => Boolean(name)),
    department: text("department", department),
    note: text("note"),
  }));
  // The picker decides on the client which inputs exist (Other's text box, for
  // one), so read the real form once it has rendered and after every remount.
  useEffect(() => {
    if (formRef.current) setPreview(readForm(formRef.current));
    // readForm only reads refs, so the remount counter is the only trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  const content = buildFutureOpportunity({
    researcherName: researcher.name,
    researcherTitle: researcher.title,
    department: preview.department,
    labName: researcher.labName,
    areaNames: preview.names,
    biography: researcher.biography,
    recruitingNeeds: researcher.recruitingNeeds,
    note: preview.note,
  });

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_380px] lg:gap-10">
      <form
        key={attempt}
        ref={formRef}
        action={action}
        onChange={(event) => setPreview(readForm(event.currentTarget))}
        className="flex min-w-0 flex-col gap-6"
      >
        <section className="rounded-[12px] border border-line bg-white px-5 py-5 sm:px-6 sm:py-6">
          <h2 className="font-display text-[19px] text-ink" style={{ letterSpacing: "-0.4px" }}>
            Research areas
          </h2>
          <p className="mt-1.5 rb-measure text-[13.5px] leading-6 text-muted">
            Prefilled from your profile. Students whose interests line up with these are matched to your posting, so
            keep the ones closest to the work you would recruit for.
          </p>
          <fieldset className="mt-4">
            <legend className="sr-only">Research areas</legend>
            <ResearchAreaPicker
              fields={fields}
              initialDisciplines={chosenOr(submitted.disciplines, disciplines)}
              initialAreaIds={initialAreaIds}
              initialAreaOther={initialOther}
              otherDiscipline={false}
              maxAreas={FUTURE_MAX_AREAS}
              errors={fieldErrors}
            />
          </fieldset>
        </section>

        <section className="rounded-[12px] border border-line bg-white px-5 py-5 sm:px-6 sm:py-6">
          <div className="flex flex-col gap-5">
            <Field
              label="Department"
              htmlFor="department"
              required
              hint="Prefilled from your profile."
              error={fieldErrors?.department?.[0]}
            >
              <Input id="department" name="department" defaultValue={text("department", department)} maxLength={160} required />
            </Field>

            <Field
              label="Anything else students should know"
              htmlFor="note"
              hint="Optional. For example, the kind of work that tends to come up, or when you usually take students on."
              error={fieldErrors?.note?.[0]}
            >
              <Textarea id="note" name="note" rows={3} defaultValue={text("note")} maxLength={1500} />
            </Field>
          </div>
        </section>

        <FormNote>
          {verified
            ? "This publishes straight away and works like any other posting: students are matched to it, can express interest, and can message you. You can edit it, add questions, or close it at any time."
            : "Your account is still being verified, so this is submitted for review rather than published. Once approved it works like any other posting."}
        </FormNote>

        {state?.ok === false ? <FormError>{state.error}</FormError> : null}

        <div className="flex flex-wrap items-center gap-3 border-t border-line pt-6">
          <Submit />
          <ButtonLink href="/researcher/opportunities/new" variant="outline">
            Back
          </ButtonLink>
        </div>
      </form>

      <aside className="lg:sticky lg:top-[76px] lg:self-start">
        <p className="mb-2 text-[12px] font-medium text-subtle">What students will see</p>
        <article className="rounded-[12px] border border-line bg-white p-5" aria-live="polite">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone="gold">{FUTURE_OPPORTUNITY_LABEL}</Badge>
            <Badge tone="outline">No fixed start date</Badge>
          </div>
          <h3 className="mt-3 font-display text-[21px] leading-7 text-ink">{content.title}</h3>
          <p className="mt-2 text-[13.5px] leading-6 text-muted">{content.summary}</p>
          {preview.names.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {preview.names.map((name) => (
                <Tag key={name}>{name}</Tag>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-[12.5px] text-warn">Choose at least one research area.</p>
          )}
          <div className="mt-4 rounded-[10px] border border-[#e6d7ae] bg-gold-soft px-3.5 py-3">
            <p className="text-[12.5px] leading-5 text-muted">{FUTURE_OPPORTUNITY_NOTICE}</p>
          </div>
          <details className="mt-4">
            <summary className="cursor-pointer text-[12.5px] font-medium text-ink">Full description</summary>
            <p className="mt-2 whitespace-pre-line text-[13px] leading-6 text-muted">{content.description}</p>
          </details>
        </article>
      </aside>
    </div>
  );
}

function chosenOr(submitted: string[] | undefined, fallback: string[]): string[] {
  return submitted && submitted.length > 0 ? submitted : fallback;
}
