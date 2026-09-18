"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { PhotoField } from "@/components/app/photo-field";
import { ResearchAreaPicker, type PickerField } from "@/components/app/research-area-picker";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/field";
import type { ActionResult } from "@/lib/errors";
import { RESEARCHER_TYPE_LABELS } from "@/lib/labels";
import { deleteResearcherAccountAction, updateResearcherProfileAction } from "./actions";

export type AdminResearcherDraft = {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  researcherType: string | null;
  title: string | null;
  faculty: string | null;
  department: string | null;
  labName: string | null;
  personalWebsite: string | null;
  linkedinUrl: string | null;
  orcidId: string | null;
  contactEmail: string | null;
  biography: string | null;
  disciplines: string[];
  disciplineOther: string | null;
  researchAreaOther: string | null;
  photoUrl: string | null;
};

function Save() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving" : "Save changes"}
    </Button>
  );
}

export function AdminResearcherForm({
  draft,
  fields,
  selectedFieldIds,
  faculties,
  departments,
  claimed,
}: {
  draft: AdminResearcherDraft;
  fields: PickerField[];
  selectedFieldIds: string[];
  faculties: string[];
  departments: string[];
  claimed: boolean;
}) {
  const [state, action] = useActionState<ActionResult | null, FormData>(updateResearcherProfileAction, null);
  const errors = state?.ok === false ? state.fieldErrors : undefined;
  const fullName = [draft.firstName, draft.lastName].filter(Boolean).join(" ");

  return (
    <form action={action} className="flex flex-col gap-5 px-5 py-5">
      <input type="hidden" name="userId" value={draft.userId} />
      <FormError>{state?.ok === false ? state.error : null}</FormError>

      <Field
        label="Sign-in email"
        htmlFor="admin-email"
        required
        hint={
          claimed
            ? "This person signs in with this address. Changing it changes what they sign in with."
            : "Nothing is emailed. Correcting this now is what lets the right person claim the profile."
        }
        error={errors?.email?.[0]}
      >
        <Input id="admin-email" name="email" type="email" defaultValue={draft.email} required />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First name" htmlFor="admin-firstName" required error={errors?.firstName?.[0]}>
          <Input id="admin-firstName" name="firstName" defaultValue={draft.firstName} maxLength={80} required />
        </Field>
        <Field label="Last name" htmlFor="admin-lastName" required error={errors?.lastName?.[0]}>
          <Input id="admin-lastName" name="lastName" defaultValue={draft.lastName} maxLength={80} required />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Role" htmlFor="admin-researcherType">
          <Select id="admin-researcherType" name="researcherType" defaultValue={draft.researcherType ?? ""}>
            <option value="">Not set</option>
            {Object.entries(RESEARCHER_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Title" htmlFor="admin-title">
          <Input id="admin-title" name="title" defaultValue={draft.title ?? ""} maxLength={160} />
        </Field>
        <Field label="Department" htmlFor="admin-department">
          <Input
            id="admin-department"
            name="department"
            list="admin-departments"
            defaultValue={draft.department ?? ""}
            maxLength={160}
          />
        </Field>
      </div>
      <datalist id="admin-departments">
        {departments.map((department) => (
          <option key={department} value={department} />
        ))}
      </datalist>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Faculty" htmlFor="admin-faculty">
          <Input id="admin-faculty" name="faculty" list="admin-faculties" defaultValue={draft.faculty ?? ""} maxLength={160} />
        </Field>
        <Field label="Lab or research group" htmlFor="admin-labName">
          <Input id="admin-labName" name="labName" defaultValue={draft.labName ?? ""} maxLength={160} />
        </Field>
      </div>
      <datalist id="admin-faculties">
        {faculties.map((faculty) => (
          <option key={faculty} value={faculty} />
        ))}
      </datalist>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Research page" htmlFor="admin-personalWebsite" error={errors?.personalWebsite?.[0]}>
          <Input id="admin-personalWebsite" name="personalWebsite" defaultValue={draft.personalWebsite ?? ""} placeholder="https://" />
        </Field>
        <Field label="LinkedIn" htmlFor="admin-linkedinUrl" error={errors?.linkedinUrl?.[0]}>
          <Input id="admin-linkedinUrl" name="linkedinUrl" defaultValue={draft.linkedinUrl ?? ""} placeholder="https://www.linkedin.com/in/" />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="ORCID iD" htmlFor="admin-orcidId" error={errors?.orcidId?.[0]}>
          <Input id="admin-orcidId" name="orcidId" defaultValue={draft.orcidId ?? ""} placeholder="0000-0002-1825-0097" />
        </Field>
        <Field
          label="Contact email"
          htmlFor="admin-contactEmail"
          hint="Shown to students, when it differs from the sign-in address."
          error={errors?.contactEmail?.[0]}
        >
          <Input id="admin-contactEmail" name="contactEmail" type="email" defaultValue={draft.contactEmail ?? ""} />
        </Field>
      </div>

      <ResearchAreaPicker
        fields={fields}
        initialDisciplines={draft.disciplines}
        initialAreaIds={selectedFieldIds}
        initialDisciplineOther={draft.disciplineOther ?? ""}
        initialAreaOther={draft.researchAreaOther ?? ""}
        errors={errors}
      />

      <Field label="Biography" htmlFor="admin-biography" error={errors?.biography?.[0]}>
        <Textarea id="admin-biography" name="biography" rows={5} defaultValue={draft.biography ?? ""} maxLength={2500} />
      </Field>

      <PhotoField
        currentUrl={draft.photoUrl}
        name={fullName}
        hint="Students see it beside this name. Choosing a new one replaces the current photo."
      />

      {state?.ok && state.message ? (
        <p role="status" className="rounded-[8px] border border-[#c2dccc] bg-moss px-3 py-2 text-[13px] text-forest">
          {state.message}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
        <Save />
        <p className="text-[12.5px] text-muted">
          {claimed
            ? "This professor has confirmed their profile, so these are their own words. Change them only to fix something they cannot."
            : "Nobody is emailed. A later import can still refresh this profile until the professor confirms it."}
        </p>
      </div>
    </form>
  );
}

function DeleteButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="danger" disabled={disabled || pending}>
      {pending ? "Deleting" : "Delete this account"}
    </Button>
  );
}

/**
 * Deleting asks for the address to be typed out rather than for a second click.
 * The reason to delete is usually that the address is wrong, and typing the one
 * on the account is the cheapest way to be sure the right row is going.
 */
export function DeleteResearcherForm({ userId, email }: { userId: string; email: string }) {
  const [state, action] = useActionState<ActionResult | null, FormData>(deleteResearcherAccountAction, null);
  const [typed, setTyped] = useState("");
  const errors = state?.ok === false ? state.fieldErrors : undefined;

  return (
    <form action={action} className="flex flex-col gap-3 px-5 py-5">
      <input type="hidden" name="userId" value={userId} />
      <p className="text-[13.5px] leading-6 text-muted">
        This removes the account and everything on it. Use it for a row that should not exist, such as a faculty list typed
        with the wrong address. An account with published positions cannot be deleted.
      </p>

      <Field
        label="Type the email on this account to confirm"
        htmlFor="confirm-delete-email"
        hint={email}
        error={errors?.confirmEmail?.[0]}
      >
        <Input
          id="confirm-delete-email"
          name="confirmEmail"
          autoComplete="off"
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          className="sm:max-w-[420px]"
        />
      </Field>

      <FormError>{state?.ok === false ? state.error : null}</FormError>

      <div>
        <DeleteButton disabled={typed.trim().toLowerCase() !== email.toLowerCase()} />
      </div>
    </form>
  );
}
