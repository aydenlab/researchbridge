"use client";

import { useActionState, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, FormError, FormNote, Input, Textarea } from "@/components/ui/field";
import type { ActionResult } from "@/lib/errors";
import { applyFacultyImportAction, previewFacultyImportAction, type ImportPreview } from "./actions";

function Submit({ label, pendingLabel, variant }: { label: string; pendingLabel: string; variant?: "outline" }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

export function FacultyImportForm() {
  const [preview, previewAction] = useActionState<ActionResult<ImportPreview> | null, FormData>(
    previewFacultyImportAction,
    null,
  );
  const [applied, applyAction] = useActionState<ActionResult | null, FormData>(applyFacultyImportAction, null);
  const [source, setSource] = useState("mcmaster_experts");
  const fileRef = useRef<HTMLInputElement>(null);

  const data = preview?.ok ? preview.data : undefined;
  const ready = data?.outcomes.filter((outcome) => outcome.status === "ready") ?? [];
  const rejected = data?.outcomes.filter((outcome) => outcome.status === "rejected") ?? [];
  const creating = ready.filter((outcome) => outcome.status === "ready" && outcome.existing === "new").length;

  return (
    <div className="flex flex-col gap-5 px-5 py-5">
      <FormNote>
        Columns are matched by name, so an export does not need renaming first. Anything recognisable as email, first
        name, last name, title, department, faculty, lab, website, LinkedIn, ORCID, biography, or research areas is
        picked up. Only email and the two names are required.
      </FormNote>

      <form action={previewAction} className="flex flex-col gap-4">
        <Field
          label="Where this list came from"
          htmlFor="source"
          hint="Recorded on each profile, so somebody who spots a wrong detail can see where it came from."
        >
          <Input
            id="source"
            name="source"
            value={source}
            onChange={(event) => setSource(event.target.value)}
            placeholder="mcmaster_experts"
          />
        </Field>

        <Field label="Paste the list" htmlFor="csv" hint="CSV, with a header row.">
          <Textarea
            id="csv"
            name="csv"
            rows={6}
            placeholder="email,first name,last name,title,department,research areas"
            className="font-mono text-[12.5px]"
          />
        </Field>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="file" className="text-[13px] font-medium text-ink">
            Or choose a CSV file
            <span className="ml-1.5 text-[11.5px] font-normal text-subtle">Up to 2 MB</span>
          </label>
          <input
            id="file"
            name="file"
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="text-[13px] text-muted file:mr-3 file:rounded-full file:border file:border-line-strong file:bg-white file:px-3.5 file:py-1.5 file:text-[13px] file:text-ink"
          />
        </div>

        <FormError>{preview?.ok === false ? preview.error : null}</FormError>

        <div>
          <Submit label="Check the list" pendingLabel="Reading" variant="outline" />
        </div>
      </form>

      {data ? (
        <div className="border-t border-line pt-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="forest">{creating} new</Badge>
            <Badge tone="neutral">{ready.length - creating} refreshed</Badge>
            {rejected.length > 0 ? <Badge tone="warn">{rejected.length} skipped</Badge> : null}
          </div>

          <p className="mt-3 text-[13px] leading-6 text-muted">
            Columns read: {data.headers.join(", ") || "none"}.
          </p>

          {ready.length > 0 ? (
            <div className="mt-4 max-h-[280px] overflow-y-auto rounded-[10px] border border-line rb-scroll">
              <table className="w-full text-left text-[12.5px]">
                <caption className="sr-only">People this import would create or refresh</caption>
                <thead className="sticky top-0 bg-shell">
                  <tr>
                    <th scope="col" className="px-3 py-2 font-medium text-subtle">Name</th>
                    <th scope="col" className="px-3 py-2 font-medium text-subtle">Email</th>
                    <th scope="col" className="px-3 py-2 font-medium text-subtle">Department</th>
                    <th scope="col" className="px-3 py-2 font-medium text-subtle">Areas</th>
                  </tr>
                </thead>
                <tbody>
                  {ready.map((outcome) =>
                    outcome.status === "ready" ? (
                      <tr key={outcome.candidate.email} className="border-t border-line">
                        <td className="px-3 py-2 text-ink">
                          {outcome.candidate.firstName} {outcome.candidate.lastName}
                        </td>
                        <td className="px-3 py-2 text-muted">{outcome.candidate.email}</td>
                        <td className="px-3 py-2 text-muted">{outcome.candidate.department ?? "Not given"}</td>
                        <td className="px-3 py-2 text-muted">
                          {outcome.candidate.researchAreas.slice(0, 3).join(", ") || "None"}
                        </td>
                      </tr>
                    ) : null,
                  )}
                </tbody>
              </table>
            </div>
          ) : null}

          {rejected.length > 0 ? (
            <div className="mt-4">
              <p className="text-[12px] font-medium text-subtle">Skipped</p>
              <ul className="mt-2 flex flex-col gap-1">
                {rejected.map((outcome) =>
                  outcome.status === "rejected" ? (
                    <li key={`${outcome.email}-${outcome.reason}`} className="text-[12.5px] leading-5 text-muted">
                      <span className="text-ink">{outcome.email}</span>: {outcome.reason}
                    </li>
                  ) : null,
                )}
              </ul>
            </div>
          ) : null}

          {ready.length > 0 ? (
            <form action={applyAction} className="mt-5 flex flex-wrap items-center gap-3">
              <input type="hidden" name="csv" value={data.csv} />
              <input type="hidden" name="source" value={data.source} />
              <Submit label={`Import ${ready.length}`} pendingLabel="Importing" />
              <p className="text-[12.5px] text-muted">
                Nobody is emailed. Accounts stay pending until each person signs in and confirms their own details.
              </p>
            </form>
          ) : null}

          <FormError>{applied?.ok === false ? applied.error : null}</FormError>
          {applied?.ok && applied.message ? (
            <p role="status" className="mt-3 rounded-[8px] border border-[#c2dccc] bg-moss px-3 py-2 text-[13px] text-forest">
              {applied.message}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
