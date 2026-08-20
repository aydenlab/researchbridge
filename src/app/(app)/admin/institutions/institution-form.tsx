"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input } from "@/components/ui/field";
import type { ActionResult } from "@/lib/errors";
import { upsertInstitutionAction } from "../actions";

type Institution = {
  id: string;
  name: string;
  slug: string;
  shortName: string;
  location: string;
  gpaScaleName: string;
  gpaScaleMax: string;
  active: boolean;
  isPilot: boolean;
  domains: string;
};

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "Saving" : label}
    </Button>
  );
}

export function InstitutionForm({ institution }: { institution: Institution | null }) {
  const [state, action] = useActionState<ActionResult | null, FormData>(upsertInstitutionAction, null);
  const prefix = institution?.id ?? "new";

  return (
    <form action={action} className="flex flex-col gap-4">
      {institution ? <input type="hidden" name="institutionId" value={institution.id} /> : null}
      <FormError>{state?.ok === false ? state.error : null}</FormError>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor={`${prefix}-name`} required>
          <Input id={`${prefix}-name`} name="name" defaultValue={institution?.name ?? ""} required />
        </Field>
        <Field label="Slug" htmlFor={`${prefix}-slug`} hint="Used in URLs. Generated from the name if left blank.">
          <Input id={`${prefix}-slug`} name="slug" defaultValue={institution?.slug ?? ""} />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Short name" htmlFor={`${prefix}-short`}>
          <Input id={`${prefix}-short`} name="shortName" defaultValue={institution?.shortName ?? ""} />
        </Field>
        <Field label="Location" htmlFor={`${prefix}-location`}>
          <Input id={`${prefix}-location`} name="location" defaultValue={institution?.location ?? ""} />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Default grading scale" htmlFor={`${prefix}-scale`} hint="For example, 12 point.">
          <Input id={`${prefix}-scale`} name="gpaScaleName" defaultValue={institution?.gpaScaleName ?? ""} />
        </Field>
        <Field label="Scale maximum" htmlFor={`${prefix}-scale-max`} hint="Never assumed to be 4.0.">
          <Input id={`${prefix}-scale-max`} name="gpaScaleMax" defaultValue={institution?.gpaScaleMax ?? ""} />
        </Field>
      </div>

      <Field
        label="Allowed email domains"
        htmlFor={`${prefix}-domains`}
        hint="Separate with commas. Anyone with a matching address can verify and create an account."
      >
        <Input id={`${prefix}-domains`} name="domains" defaultValue={institution?.domains ?? ""} placeholder="example.edu, alumni.example.edu" />
      </Field>

      <div className="flex flex-wrap gap-3">
        <label className="flex cursor-pointer items-center gap-2 rounded-[8px] border border-line bg-white px-3 py-2">
          <input type="checkbox" name="active" value="true" defaultChecked={institution?.active ?? true} className="size-4 accent-[#1d4436]" />
          <span className="text-[13.5px] text-ink">Active</span>
        </label>
        <label className="flex cursor-pointer items-center gap-2 rounded-[8px] border border-line bg-white px-3 py-2">
          <input type="checkbox" name="isPilot" value="true" defaultChecked={institution?.isPilot ?? false} className="size-4 accent-[#1d4436]" />
          <span className="text-[13.5px] text-ink">Pilot institution</span>
        </label>
      </div>

      <div className="flex items-center gap-3">
        <Submit label={institution ? "Save changes" : "Create institution"} />
        {state?.ok ? <p className="text-[12.5px] text-ok">{state.message}</p> : null}
      </div>
    </form>
  );
}
