"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input } from "@/components/ui/field";
import type { ActionResult } from "@/lib/errors";
import { attachResumeAction } from "@/app/(app)/applications/actions";

function UploadButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "Uploading" : "Upload resume"}
    </Button>
  );
}

/**
 * Onboarding never forces a resume, so a student can reach the application form
 * without one. Asking here, in place, is the difference between a small detour
 * and abandoning a half-written application.
 */
export function ResumeGate({ applicationId, hasResume }: { applicationId: string; hasResume: boolean }) {
  const [state, action] = useActionState<ActionResult | null, FormData>(attachResumeAction, null);

  if (hasResume || state?.ok) {
    return (
      <div className="rounded-[10px] border border-[#c2dccc] bg-moss px-4 py-3">
        <p className="text-[13.5px] text-ok">
          Resume attached. It is taken from your profile and sent with this application.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-[10px] border border-[#e6d7ae] bg-gold-soft px-4 py-3.5">
      <p className="text-[14px] font-medium text-ink">A resume is required to submit</p>
      <p className="mt-1 text-[13px] leading-6 text-muted">
        You do not have one on your profile yet. Upload it here and it is saved for every future application, so this
        is the only time you will be asked.
      </p>

      <form action={action} className="mt-3 flex flex-col gap-3">
        <input type="hidden" name="applicationId" value={applicationId} />
        <FormError>{state?.ok === false ? state.error : null}</FormError>
        <Field label="Resume" htmlFor="applicationResume" hint="PDF only, up to 8 MB.">
          <Input
            id="applicationResume"
            name="resume"
            type="file"
            accept="application/pdf"
            required
            className="py-1.5"
          />
        </Field>
        <div>
          <UploadButton />
        </div>
      </form>
    </div>
  );
}
