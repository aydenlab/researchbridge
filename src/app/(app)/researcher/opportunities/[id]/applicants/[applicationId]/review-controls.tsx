"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormError, RadioRow, Textarea } from "@/components/ui/field";
import { STATUS_LABELS, type ApplicationStatus } from "@/lib/application-status";
import type { ActionResult } from "@/lib/errors";
import { formatShortDate } from "@/lib/format";
import {
  addNoteAction,
  contactStudentAction,
  deleteNoteAction,
  recordPlacementAction,
  refreshEvidenceAction,
  updateApplicationStatusAction,
} from "../actions";

function Pending({ label, pendingLabel, variant = "primary", size = "md" }: { label: string; pendingLabel: string; variant?: "primary" | "outline" | "danger" | "secondary"; size?: "sm" | "md" }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} size={size} disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

export function StatusActions({
  applicationId,
  currentStatus,
  allowed,
}: {
  applicationId: string;
  currentStatus: ApplicationStatus;
  allowed: ApplicationStatus[];
}) {
  const [state, action] = useActionState<ActionResult | null, FormData>(updateApplicationStatusAction, null);

  if (allowed.length === 0) {
    return (
      <p className="text-[12.5px] leading-5 text-muted">
        This application is at {STATUS_LABELS[currentStatus].toLowerCase()} and has no further transitions.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap gap-2">
        {allowed.map((status) => (
          <form key={status} action={action}>
            <input type="hidden" name="applicationId" value={applicationId} />
            <input type="hidden" name="status" value={status} />
            <Pending
              label={STATUS_LABELS[status]}
              pendingLabel="Saving"
              size="sm"
              variant={status === "declined" ? "danger" : status === "accepted" ? "primary" : "outline"}
            />
          </form>
        ))}
      </div>
      {state?.ok === false ? (
        <p role="alert" className="text-[12.5px] text-bad">
          {state.error}
        </p>
      ) : null}
      {state?.ok ? <p className="text-[12.5px] text-ok">{state.message}</p> : null}
      <p className="text-[12px] leading-5 text-subtle">
        The student sees a plain description of each state and is notified when it changes. Every change is recorded.
      </p>
    </div>
  );
}

export function ContactControl({ applicationId, alreadyContacted }: { applicationId: string; alreadyContacted: boolean }) {
  const [state, action] = useActionState<ActionResult | null, FormData>(contactStudentAction, null);
  const [open, setOpen] = useState(false);

  if (state?.ok) {
    return <p className="text-[13px] leading-6 text-ok">{state.message}</p>;
  }

  if (alreadyContacted) {
    return (
      <p className="text-[12.5px] leading-5 text-muted">
        You have already asked to move forward with this student. They can reply to your email directly.
      </p>
    );
  }

  if (!open) {
    return (
      <Button type="button" onClick={() => setOpen(true)}>
        Contact student
      </Button>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="applicationId" value={applicationId} />
      <FormError>{state?.ok === false ? state.error : null}</FormError>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="contact-message" className="text-[13px] font-medium text-ink">
          Message to the student
        </label>
        <Textarea
          id="contact-message"
          name="message"
          rows={4}
          maxLength={1500}
          defaultValue="I would like to arrange a time to talk about the project. Let me know what works for you."
        />
        <p className="text-[12px] leading-5 text-muted">
          Sent from ResearchBridge with your institutional address as the reply-to, so the student can respond to you
          directly. The application is marked as contacted and the action is recorded.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Pending label="Send and mark as contacted" pendingLabel="Sending" />
        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function RefreshEvidence({ applicationId }: { applicationId: string }) {
  const [state, action] = useActionState<ActionResult | null, FormData>(refreshEvidenceAction, null);
  const { pending } = useFormStatus();

  return (
    <div className="flex flex-col items-end gap-1.5">
      <form action={action}>
        <input type="hidden" name="applicationId" value={applicationId} />
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line-strong bg-white px-3.5 text-[12.5px] text-ink transition-colors hover:bg-shell disabled:opacity-50"
        >
          <RefreshCw className="size-3.5" aria-hidden="true" />
          Refresh evidence
        </button>
      </form>
      {state?.ok ? <p className="text-[11.5px] text-ok">{state.message}</p> : null}
      {state?.ok === false ? (
        <p role="alert" className="text-[11.5px] text-bad">
          {state.error}
        </p>
      ) : null}
    </div>
  );
}

export function NotesPanel({
  applicationId,
  notes,
}: {
  applicationId: string;
  notes: { id: string; note: string; createdAt: Date }[];
}) {
  const [addState, addAction] = useActionState<ActionResult | null, FormData>(addNoteAction, null);
  const [, deleteAction] = useActionState<ActionResult | null, FormData>(deleteNoteAction, null);

  return (
    <section className="rounded-[12px] border border-line bg-white">
      <div className="border-b border-line px-5 py-3.5">
        <h2 className="font-display text-[17px] text-ink">Your private notes</h2>
        <p className="mt-1 text-[12px] leading-5 text-muted">Never shown to students and never included in exports.</p>
      </div>

      <div className="px-5 py-4">
        <form action={addAction} className="flex flex-col gap-2.5">
          <input type="hidden" name="applicationId" value={applicationId} />
          <FormError>{addState?.ok === false ? addState.error : null}</FormError>
          <label htmlFor="note" className="sr-only">
            Add a note
          </label>
          <Textarea id="note" name="note" rows={3} maxLength={4000} placeholder="What you want to remember about this candidate." />
          <div>
            <Pending label="Save note" pendingLabel="Saving" size="sm" variant="outline" />
          </div>
        </form>

        {notes.length > 0 ? (
          <ul className="mt-4 flex flex-col gap-3 border-t border-line pt-4">
            {notes.map((note) => (
              <li key={note.id} className="rounded-[8px] border border-line bg-shell/60 px-3.5 py-3">
                <p className="whitespace-pre-wrap text-[13.5px] leading-6 text-ink">{note.note}</p>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <p className="text-[11.5px] text-subtle">{formatShortDate(note.createdAt)}</p>
                  <form action={deleteAction}>
                    <input type="hidden" name="applicationId" value={applicationId} />
                    <input type="hidden" name="noteId" value={note.id} />
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1 text-[11.5px] text-muted transition-colors hover:text-bad"
                    >
                      <Trash2 className="size-3" aria-hidden="true" />
                      Remove
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 border-t border-line pt-4 text-[13px] leading-6 text-muted">No notes yet.</p>
        )}
      </div>
    </section>
  );
}

export function PlacementForm({ applicationId, recorded }: { applicationId: string; recorded: string | null }) {
  const [state, action] = useActionState<ActionResult | null, FormData>(recordPlacementAction, null);

  if (state?.ok) return <p className="text-[13px] text-ok">{state.message}</p>;
  if (recorded) {
    return (
      <p className="text-[13px] leading-6 text-muted">
        You reported this as <span className="font-medium text-ink">{recorded.replace(/_/g, " ")}</span>. Thank you.
      </p>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="applicationId" value={applicationId} />
      <FormError>{state?.ok === false ? state.error : null}</FormError>

      <fieldset className="grid gap-2 sm:grid-cols-2">
        <legend className="mb-1 text-[13px] font-medium text-ink">Did you fill this position through ResearchBridge?</legend>
        <RadioRow id="placement-yes" name="outcome" value="yes" label="Yes" />
        <RadioRow id="placement-progress" name="outcome" value="in_progress" label="Still in progress" />
        <RadioRow id="placement-no" name="outcome" value="no" label="No" />
        <RadioRow id="placement-private" name="outcome" value="prefer_not_to_say" label="Prefer not to say" />
      </fieldset>

      <label className="flex cursor-pointer items-start gap-2.5 rounded-[8px] border border-line bg-white px-3 py-2.5">
        <input type="checkbox" name="wouldUseAgain" value="true" className="mt-0.5 size-4 accent-[#1d4436]" />
        <span className="text-[13.5px] text-ink">I would use ResearchBridge again</span>
      </label>

      <div>
        <Pending label="Record outcome" pendingLabel="Saving" size="sm" variant="outline" />
      </div>
    </form>
  );
}
