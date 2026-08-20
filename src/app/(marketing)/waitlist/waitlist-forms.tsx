"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/field";
import type { ActionResult } from "@/lib/errors";
import { joinStudentWaitlistAction, registerResearcherInterestAction } from "./actions";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending}>
      {pending ? "Sending" : label}
    </Button>
  );
}

function Success({ message, kind }: { message: string; kind: "student" | "researcher" }) {
  return (
    <div className="rounded-[12px] border border-[#c2dccc] bg-moss px-6 py-8">
      <div className="flex items-start gap-3">
        <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-ok" aria-hidden="true" />
        <div>
          <p className="font-display text-[22px] text-forest" style={{ letterSpacing: "-0.4px" }}>
            {message}
          </p>
          <p className="mt-2 text-[14.5px] leading-7 text-forest/85">
            {kind === "student"
              ? "We will email you before the first cohort opens. Nothing else is needed from you right now, and there is no account to create yet."
              : "Someone from the team will get in touch to talk through the positions you might post."}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/opportunities"
              className="inline-flex h-10 items-center rounded-full bg-ink px-5 text-sm font-medium text-white transition-transform hover:scale-[1.03]"
            >
              See what is open now
            </Link>
            <Link
              href="/how-it-works"
              className="inline-flex h-10 items-center rounded-full border border-forest/30 bg-white/70 px-5 text-sm font-medium text-forest"
            >
              How it works
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export function StudentWaitlistForm() {
  const [state, action] = useActionState<ActionResult | null, FormData>(joinStudentWaitlistAction, null);
  const errors = state?.ok === false ? state.fieldErrors : undefined;

  if (state?.ok) return <Success message={state.message ?? "You are on the list."} kind="student" />;

  return (
    <form action={action} className="flex flex-col gap-5">
      <FormError>{state?.ok === false ? state.error : null}</FormError>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="First name" htmlFor="firstName" required error={errors?.firstName?.[0]}>
          <Input id="firstName" name="firstName" autoComplete="given-name" required />
        </Field>
        <Field label="Last name" htmlFor="lastName" required error={errors?.lastName?.[0]}>
          <Input id="lastName" name="lastName" autoComplete="family-name" required />
        </Field>
      </div>

      <Field
        label="Institutional email"
        htmlFor="email"
        required
        error={errors?.email?.[0]}
        hint="Use the email address your university issued you. Any institution is welcome to register interest."
      >
        <Input id="email" name="email" type="email" autoComplete="email" placeholder="name@university.ca" required />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Program" htmlFor="program">
          <Input id="program" name="program" placeholder="Bachelor of Health Sciences" />
        </Field>
        <Field label="Year of study" htmlFor="yearLevel">
          <Select id="yearLevel" name="yearLevel" defaultValue="">
            <option value="">Prefer not to say</option>
            {["Year 1", "Year 2", "Year 3", "Year 4", "Year 5 or beyond", "Master's", "PhD"].map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field
        label="Research areas that interest you"
        htmlFor="researchInterests"
        hint="A few words is enough. It helps us line up the right researchers for the first cohort."
      >
        <Textarea id="researchInterests" name="researchInterests" rows={3} maxLength={600} placeholder="Neuroscience, public health, anything clinical" />
      </Field>

      <label className="flex cursor-pointer items-start gap-2.5 rounded-[8px] border border-line bg-white px-3 py-2.5">
        <input type="checkbox" name="willingToPilot" value="true" defaultChecked className="mt-0.5 size-4 accent-[#1d4436]" />
        <span className="text-[13.5px] leading-6 text-ink">
          I would like to take part in the first pilot cohort
        </span>
      </label>

      <div>
        <label className="flex cursor-pointer items-start gap-2.5 rounded-[8px] border border-line bg-white px-3 py-2.5">
          <input type="checkbox" name="contactConsent" value="true" required className="mt-0.5 size-4 accent-[#1d4436]" />
          <span className="text-[13.5px] leading-6 text-ink">
            ResearchBridge may email me about the pilot. <span className="text-clay">*</span>
          </span>
        </label>
        {errors?.contactConsent?.[0] ? (
          <p role="alert" className="mt-1.5 text-[12.5px] text-bad">
            {errors.contactConsent[0]}
          </p>
        ) : null}
      </div>

      <div>
        <Submit label="Join the pilot waitlist" />
      </div>

      <p className="text-[12.5px] leading-5 text-subtle">
        No account is created and there is nothing to confirm. You can ask to be removed at any time by writing to
        hello@myresearchbridge.com.
      </p>
    </form>
  );
}

export function ResearcherInterestForm() {
  const [state, action] = useActionState<ActionResult | null, FormData>(registerResearcherInterestAction, null);
  const errors = state?.ok === false ? state.fieldErrors : undefined;

  if (state?.ok) return <Success message={state.message ?? "Thank you."} kind="researcher" />;

  return (
    <form action={action} className="flex flex-col gap-5">
      <FormError>{state?.ok === false ? state.error : null}</FormError>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="First name" htmlFor="firstName" required error={errors?.firstName?.[0]}>
          <Input id="firstName" name="firstName" autoComplete="given-name" required />
        </Field>
        <Field label="Last name" htmlFor="lastName" required error={errors?.lastName?.[0]}>
          <Input id="lastName" name="lastName" autoComplete="family-name" required />
        </Field>
      </div>

      <Field label="Institutional email" htmlFor="email" required error={errors?.email?.[0]}>
        <Input id="email" name="email" type="email" autoComplete="email" placeholder="name@university.ca" required />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Title or role" htmlFor="title">
          <Input id="title" name="title" placeholder="Associate Professor, PhD candidate, lab manager" />
        </Field>
        <Field label="Department" htmlFor="department">
          <Input id="department" name="department" />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Lab or research group" htmlFor="labName">
          <Input id="labName" name="labName" />
        </Field>
        <Field
          label="Students you might recruit"
          htmlFor="expectedStudentCount"
          hint="A rough number is fine."
        >
          <Input id="expectedStudentCount" name="expectedStudentCount" type="number" min={0} max={100} />
        </Field>
      </div>

      <Field label="Research area" htmlFor="researchInterests">
        <Input id="researchInterests" name="researchInterests" placeholder="Cardiovascular epidemiology, immunology" />
      </Field>

      <Field
        label="What kind of help do you need?"
        htmlFor="helpNeeded"
        hint="Data cleaning, literature screening, bench work, participant scheduling, anything else."
      >
        <Textarea id="helpNeeded" name="helpNeeded" rows={3} maxLength={800} />
      </Field>

      <Field label="Anything else" htmlFor="comments">
        <Textarea id="comments" name="comments" rows={3} maxLength={1200} placeholder="Timing, constraints, or questions." />
      </Field>

      <div>
        <label className="flex cursor-pointer items-start gap-2.5 rounded-[8px] border border-line bg-white px-3 py-2.5">
          <input type="checkbox" name="contactConsent" value="true" required className="mt-0.5 size-4 accent-[#1d4436]" />
          <span className="text-[13.5px] leading-6 text-ink">
            ResearchBridge may contact me about taking part. <span className="text-clay">*</span>
          </span>
        </label>
        {errors?.contactConsent?.[0] ? (
          <p role="alert" className="mt-1.5 text-[12.5px] text-bad">
            {errors.contactConsent[0]}
          </p>
        ) : null}
      </div>

      <div>
        <Submit label="Register interest" />
      </div>
    </form>
  );
}
