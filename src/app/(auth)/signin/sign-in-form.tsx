"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FormError, FormNote, Input } from "@/components/ui/field";
import type { ActionResult } from "@/lib/errors";
import { requestCodeAction, verifyCodeAction } from "./actions";

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending} className="w-full">
      {pending ? pendingLabel : label}
    </Button>
  );
}

export function SignInForm() {
  const [emailState, emailAction] = useActionState<ActionResult<{ email: string }> | null, FormData>(
    requestCodeAction,
    null,
  );
  const [codeState, codeAction] = useActionState<ActionResult | null, FormData>(verifyCodeAction, null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  useEffect(() => {
    if (emailState?.ok && emailState.data?.email) setSentTo(emailState.data.email);
  }, [emailState]);

  if (!sentTo) {
    return (
      <div>
        <h1 className="font-display text-[30px] text-ink" style={{ letterSpacing: "-0.5px" }}>
          Sign in to ResearchBridge
        </h1>
        <p className="mt-3 text-[14.5px] leading-6 text-muted">
          Enter your institutional email address. We send a six-digit code to confirm it is you. There is no password to
          remember.
        </p>

        <form action={emailAction} className="mt-8 flex flex-col gap-4">
          <FormError>{emailState?.ok === false ? emailState.error : null}</FormError>

          <Field
            label="Institutional email"
            htmlFor="email"
            required
            hint="Use the email address your university issued you."
            error={emailState?.ok === false ? emailState.fieldErrors?.email?.[0] : undefined}
          >
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              required
              placeholder="name@university.ca"
              aria-describedby="email-hint"
            />
          </Field>

          <SubmitButton label="Send verification code" pendingLabel="Sending code" />
        </form>

        <FormNote>
          Not part of the pilot yet?{" "}
          <Link href="/waitlist" className="underline decoration-line-strong underline-offset-4 hover:text-ink">
            Join the student waitlist
          </Link>{" "}
          or{" "}
          <Link href="/researchers/interest" className="underline decoration-line-strong underline-offset-4 hover:text-ink">
            register interest as a researcher
          </Link>
          .
        </FormNote>
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setSentTo(null)}
        className="mb-6 inline-flex items-center gap-1.5 text-[13px] text-muted transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" />
        Use a different email
      </button>

      <h1 className="font-display text-[30px] text-ink" style={{ letterSpacing: "-0.5px" }}>
        Check your email
      </h1>
      <p className="mt-3 text-[14.5px] leading-6 text-muted">
        We sent a six-digit code to <span className="font-medium text-ink">{sentTo}</span>. It expires in ten minutes and
        can be used once.
      </p>

      <form action={codeAction} className="mt-8 flex flex-col gap-4">
        <FormError>{codeState?.ok === false ? codeState.error : null}</FormError>
        <input type="hidden" name="email" value={sentTo} />

        <Field
          label="Verification code"
          htmlFor="code"
          required
          error={codeState?.ok === false ? codeState.fieldErrors?.code?.[0] : undefined}
        >
          <Input
            id="code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            autoFocus
            placeholder="000000"
            className="text-center font-mono text-[22px] tracking-[0.4em]"
          />
        </Field>

        <SubmitButton label="Verify and continue" pendingLabel="Verifying" />
      </form>

      <form action={emailAction} className="mt-4">
        <input type="hidden" name="email" value={sentTo} />
        <button type="submit" className="text-[13px] text-muted underline decoration-line-strong underline-offset-4 hover:text-ink">
          Send a new code
        </button>
      </form>

      <FormNote>
        In local development, verification codes are printed to the server console instead of being emailed.
      </FormNote>
    </div>
  );
}
