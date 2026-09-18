"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { PhotoField } from "@/components/app/photo-field";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input, Textarea } from "@/components/ui/field";
import type { ActionResult } from "@/lib/errors";
import { addFacultyMemberAction } from "./actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Adding" : "Add professor"}
    </Button>
  );
}

export function AddFacultyForm() {
  const [state, action] = useActionState<ActionResult | null, FormData>(addFacultyMemberAction, null);

  // Clear the fields after a successful add so the next person starts blank.
  // A refusal keeps them, since React only resets the form we remount.
  const [added, setAdded] = useState(0);
  useEffect(() => {
    if (state?.ok) setAdded((count) => count + 1);
  }, [state]);

  return (
    <form key={added} action={action} className="flex flex-col gap-4 px-5 py-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Email" htmlFor="add-email" required>
          <Input id="add-email" name="email" type="email" placeholder="name@mcmaster.ca" required />
        </Field>
        <Field label="First name" htmlFor="add-firstName" required>
          <Input id="add-firstName" name="firstName" maxLength={80} required />
        </Field>
        <Field label="Last name" htmlFor="add-lastName" required>
          <Input id="add-lastName" name="lastName" maxLength={80} required />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Title" htmlFor="add-title">
          <Input id="add-title" name="title" placeholder="Associate Professor" maxLength={160} />
        </Field>
        <Field label="Department" htmlFor="add-department">
          <Input id="add-department" name="department" maxLength={160} />
        </Field>
        <Field label="Faculty" htmlFor="add-faculty">
          <Input id="add-faculty" name="faculty" placeholder="Health Sciences" maxLength={160} />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Lab or research group" htmlFor="add-labName">
          <Input id="add-labName" name="labName" maxLength={160} />
        </Field>
        <Field label="Research page" htmlFor="add-personalWebsite" hint="Their faculty or lab research page.">
          <Input id="add-personalWebsite" name="personalWebsite" placeholder="example.org/research" />
        </Field>
        <Field label="LinkedIn" htmlFor="add-linkedinUrl">
          <Input id="add-linkedinUrl" name="linkedinUrl" placeholder="linkedin.com/in/" />
        </Field>
      </div>

      <Field label="Research areas" htmlFor="add-researchAreas" hint="Separate with commas.">
        <Input id="add-researchAreas" name="researchAreas" placeholder="Cardiology, Epidemiology" />
      </Field>

      <Field label="Short bio" htmlFor="add-biography">
        <Textarea id="add-biography" name="biography" rows={3} maxLength={2500} />
      </Field>

      <PhotoField
        currentUrl={null}
        name=""
        label="Profile photo"
        hint="Usually the headshot from their department page. They can change it when they sign in."
      />

      <FormError>{state?.ok === false ? state.error : null}</FormError>
      {state?.ok && state.message ? (
        <p role="status" className="rounded-[8px] border border-[#c2dccc] bg-moss px-3 py-2 text-[13px] text-forest">
          {state.message}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Submit />
        <p className="text-[12.5px] text-muted">
          Nobody is emailed. The profile waits until the professor signs in and confirms it.
        </p>
      </div>
    </form>
  );
}
