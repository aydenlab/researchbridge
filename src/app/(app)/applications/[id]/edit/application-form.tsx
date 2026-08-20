"use client";

import Link from "next/link";
import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { BookOpen, Check, ExternalLink, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FormError, FormNote, Input, Select, Textarea } from "@/components/ui/field";
import type { ActionResult } from "@/lib/errors";
import { saveDraftAction, submitApplicationAction } from "../../actions";

export type Question = {
  id: string;
  type: string;
  prompt: string;
  helpText: string | null;
  required: boolean;
  config: Record<string, unknown>;
};

export type Material = {
  id: string;
  title: string;
  authors: string | null;
  url: string | null;
  doi: string | null;
  abstract: string | null;
  context: string | null;
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending}>
      {pending ? "Submitting" : "Submit application"}
    </Button>
  );
}

function maxLengthOf(config: Record<string, unknown>): number | undefined {
  const value = config.maxLength;
  return typeof value === "number" ? value : undefined;
}

function optionsOf(config: Record<string, unknown>): string[] {
  const value = config.options;
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export function ApplicationForm({
  applicationId,
  opportunityTitle,
  opportunitySlug,
  researcherName,
  questions,
  materials,
  answers,
  profileSummary,
  videoEnabled,
  videoPrompt,
  videoMaxSeconds,
}: {
  applicationId: string;
  opportunityTitle: string;
  opportunitySlug: string;
  researcherName: string;
  questions: Question[];
  materials: Material[];
  answers: Record<string, { textAnswer: string | null; fileId: string | null; externalUrl: string | null }>;
  profileSummary: { label: string; value: string }[];
  videoEnabled: boolean;
  videoPrompt: string | null;
  videoMaxSeconds: number;
}) {
  const [state, action] = useActionState<ActionResult | null, FormData>(submitApplicationAction, null);
  const formRef = useRef<HTMLFormElement>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [counts, setCounts] = useState<Record<string, number>>(() =>
    Object.fromEntries(questions.map((question) => [question.id, answers[question.id]?.textAnswer?.length ?? 0])),
  );
  const timer = useRef<number | null>(null);

  const saveDraft = useCallback(async () => {
    const form = formRef.current;
    if (!form) return;
    setSaveStatus("saving");
    const data = new FormData(form);
    for (const [key, value] of [...data.entries()]) {
      if (value instanceof File) data.delete(key);
    }
    const result = await saveDraftAction(null, data);
    setSaveStatus(result?.ok ? "saved" : "error");
  }, []);

  useEffect(() => {
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, []);

  function scheduleSave() {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void saveDraft(), 2500);
  }

  const errors = state?.ok === false ? state.fieldErrors : undefined;

  return (
    <form ref={formRef} action={action} onChange={scheduleSave} className="flex flex-col gap-7">
      <input type="hidden" name="applicationId" value={applicationId} />

      <FormError>{state?.ok === false ? state.error : null}</FormError>

      <section className="rounded-[12px] border border-line bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-[20px] text-ink" style={{ letterSpacing: "-0.4px" }}>
            Your ResearchBridge profile will be included with this application
          </h2>
          <Link
            href="/profile"
            className="text-[13px] text-forest underline decoration-line-strong underline-offset-4 hover:text-ink"
          >
            Edit profile
          </Link>
        </div>
        <p className="mt-2 text-[13.5px] leading-6 text-muted">
          {researcherName} sees the details below alongside your answers. A copy is stored with this application, so
          later profile edits do not rewrite what you sent.
        </p>
        <dl className="mt-4 divide-y divide-line border-t border-line">
          {profileSummary.map((item) => (
            <div key={item.label} className="grid gap-1 py-2.5 sm:grid-cols-[180px_1fr] sm:gap-4">
              <dt className="text-[12.5px] text-subtle">{item.label}</dt>
              <dd className="text-[13.5px] leading-6 text-ink">{item.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {materials.length > 0 ? (
        <section className="rounded-[12px] border border-line bg-white p-5">
          <p className="text-[12px] font-medium text-subtle">Research material</p>
          <h2 className="mt-2 font-display text-[20px] text-ink" style={{ letterSpacing: "-0.4px" }}>
            This researcher has asked applicants to review a recent paper before applying
          </h2>
          <ul className="mt-4 flex flex-col gap-3">
            {materials.map((material) => (
              <li key={material.id} className="rounded-[10px] border border-line bg-shell/60 p-4">
                <div className="flex items-start gap-2.5">
                  <BookOpen className="mt-1 size-4 shrink-0 text-forest" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-[15px] font-medium leading-6 text-ink">{material.title}</p>
                    {material.authors ? <p className="mt-0.5 text-[13px] text-muted">{material.authors}</p> : null}
                    {material.doi ? <p className="mt-0.5 font-mono text-[12px] text-subtle">DOI {material.doi}</p> : null}
                    {material.context ? (
                      <p className="mt-2 text-[13.5px] leading-6 text-muted">From the researcher: {material.context}</p>
                    ) : null}
                    {material.url ? (
                      <a
                        href={material.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 inline-flex items-center gap-1.5 text-[13.5px] font-medium text-forest underline decoration-line-strong underline-offset-4"
                      >
                        Open the paper in a new tab
                        <ExternalLink className="size-3.5" aria-hidden="true" />
                      </a>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="rounded-[12px] border border-line bg-white p-5">
        <h2 className="font-display text-[20px] text-ink" style={{ letterSpacing: "-0.4px" }}>
          Questions from {researcherName}
        </h2>
        <p className="mt-2 text-[13.5px] leading-6 text-muted">
          These questions were written for this project. Your draft saves automatically as you type.
        </p>

        {questions.length === 0 ? (
          <p className="mt-4 rounded-[10px] border border-line bg-shell/60 px-4 py-3 text-[14px] text-muted">
            This position asks only for your profile. There is nothing else to answer.
          </p>
        ) : null}

        <div className="mt-5 flex flex-col gap-6">
          {questions.map((question, index) => {
            const key = `q_${question.id}`;
            const answer = answers[question.id];
            const maxLength = maxLengthOf(question.config);
            const label = `${String(index + 1).padStart(2, "0")}. ${question.prompt}`;

            if (question.type === "yes_no") {
              return (
                <Field key={question.id} label={label} htmlFor={key} required={question.required} hint={question.helpText ?? undefined} error={errors?.[key]?.[0]}>
                  <Select id={key} name={key} defaultValue={answer?.textAnswer ?? ""} required={question.required}>
                    <option value="">Choose an answer</option>
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </Select>
                </Field>
              );
            }

            if (question.type === "multiple_choice") {
              return (
                <Field key={question.id} label={label} htmlFor={key} required={question.required} hint={question.helpText ?? undefined} error={errors?.[key]?.[0]}>
                  <Select id={key} name={key} defaultValue={answer?.textAnswer ?? ""} required={question.required}>
                    <option value="">Choose an answer</option>
                    {optionsOf(question.config).map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </Select>
                </Field>
              );
            }

            if (question.type === "numeric") {
              return (
                <Field key={question.id} label={label} htmlFor={key} required={question.required} hint={question.helpText ?? undefined} error={errors?.[key]?.[0]}>
                  <Input
                    id={key}
                    name={key}
                    type="number"
                    defaultValue={answer?.textAnswer ?? ""}
                    required={question.required}
                    min={typeof question.config.min === "number" ? question.config.min : undefined}
                    max={typeof question.config.max === "number" ? question.config.max : undefined}
                  />
                </Field>
              );
            }

            if (question.type === "file_upload") {
              return (
                <Field key={question.id} label={label} htmlFor={key} required={question.required} hint={question.helpText ?? "PDF, PNG, JPEG, or plain text up to 12 MB."} error={errors?.[key]?.[0]}>
                  <Input id={key} name={key} type="file" accept="application/pdf,image/png,image/jpeg,text/plain" className="py-1.5" />
                  {answer?.fileId ? (
                    <p className="mt-1.5 inline-flex items-center gap-1.5 text-[12.5px] text-ok">
                      <Check className="size-3.5" aria-hidden="true" />A file is already attached. Uploading again
                      replaces it.
                    </p>
                  ) : null}
                </Field>
              );
            }

            if (question.type === "video_response") {
              return (
                <Field
                  key={question.id}
                  label={label}
                  htmlFor={key}
                  required={question.required}
                  hint={question.helpText ?? "Record elsewhere and paste a link the researcher can open."}
                  error={errors?.[key]?.[0]}
                >
                  <Input id={key} name={key} type="url" placeholder="https://" defaultValue={answer?.externalUrl ?? ""} />
                </Field>
              );
            }

            if (question.type === "short_text") {
              return (
                <Field key={question.id} label={label} htmlFor={key} required={question.required} hint={question.helpText ?? undefined} error={errors?.[key]?.[0]}>
                  <Input id={key} name={key} defaultValue={answer?.textAnswer ?? ""} maxLength={maxLength} required={question.required} />
                </Field>
              );
            }

            return (
              <div key={question.id}>
                <Field
                  label={label}
                  htmlFor={key}
                  required={question.required}
                  hint={question.helpText ?? undefined}
                  error={errors?.[key]?.[0]}
                >
                  {question.type === "paper_response" ? <Badge tone="gold" className="mb-1.5">Paper response</Badge> : null}
                  <Textarea
                    id={key}
                    name={key}
                    rows={9}
                    maxLength={maxLength}
                    defaultValue={answer?.textAnswer ?? ""}
                    required={question.required}
                    onChange={(event) => setCounts((current) => ({ ...current, [question.id]: event.target.value.length }))}
                  />
                </Field>
                {maxLength ? (
                  <p className="mt-1 text-right text-[12px] text-subtle">
                    {counts[question.id] ?? 0} of {maxLength} characters
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      {videoEnabled ? (
        <section className="rounded-[12px] border border-[#e6d7ae] bg-gold-soft p-5">
          <h2 className="font-display text-[19px] text-warn" style={{ letterSpacing: "-0.4px" }}>
            This position includes a short video response
          </h2>
          <p className="mt-2 text-[13.5px] leading-6 text-warn">
            {videoPrompt ?? "Record a short response to the prompt this researcher provided."} Keep it under{" "}
            {videoMaxSeconds} seconds. Record it wherever you like and paste a link the researcher can open. Nothing
            about your appearance, delivery, or voice is analyzed.
          </p>
        </section>
      ) : null}

      <section className="rounded-[12px] border border-line bg-white p-5">
        <h2 className="font-display text-[20px] text-ink" style={{ letterSpacing: "-0.4px" }}>
          Before you submit
        </h2>
        <dl className="mt-3 divide-y divide-line border-y border-line">
          <div className="grid gap-1 py-2.5 sm:grid-cols-[180px_1fr] sm:gap-4">
            <dt className="text-[12.5px] text-subtle">Researcher</dt>
            <dd className="text-[13.5px] text-ink">{researcherName}</dd>
          </div>
          <div className="grid gap-1 py-2.5 sm:grid-cols-[180px_1fr] sm:gap-4">
            <dt className="text-[12.5px] text-subtle">Project</dt>
            <dd className="text-[13.5px] text-ink">
              <Link href={`/opportunities/${opportunitySlug}`} className="underline decoration-line-strong underline-offset-4">
                {opportunityTitle}
              </Link>
            </dd>
          </div>
          <div className="grid gap-1 py-2.5 sm:grid-cols-[180px_1fr] sm:gap-4">
            <dt className="text-[12.5px] text-subtle">Information shared</dt>
            <dd className="text-[13.5px] leading-6 text-ink">
              Your profile as shown above, your answers to the questions on this page, and any files you attached.
            </dd>
          </div>
        </dl>

        <FormNote>
          Once submitted, an application cannot be edited. You can withdraw it at any time from your applications page.
        </FormNote>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <SubmitButton />
          <Button type="button" variant="outline" onClick={() => void saveDraft()}>
            Save draft
          </Button>
          <span className="inline-flex items-center gap-1.5 text-[12.5px] text-muted" aria-live="polite">
            {saveStatus === "saving" ? (
              <>
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                Saving draft
              </>
            ) : saveStatus === "saved" ? (
              <>
                <Check className="size-3.5 text-ok" aria-hidden="true" />
                Draft saved
              </>
            ) : saveStatus === "error" ? (
              <span className="text-bad">Draft could not be saved. Try the save draft button.</span>
            ) : (
              "Your draft saves automatically."
            )}
          </span>
        </div>
      </section>
    </form>
  );
}
