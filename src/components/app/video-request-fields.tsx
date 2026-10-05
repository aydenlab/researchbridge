"use client";

import { useState } from "react";
import { Video } from "lucide-react";
import { Field, Select, Textarea } from "@/components/ui/field";
import { VIDEO_LENGTH_OPTIONS, VIDEO_PROMPT_SUGGESTIONS, formatVideoLength } from "@/lib/video-links";

export type VideoRequestDraft = {
  enabled: boolean;
  prompt: string;
  required: boolean;
  maxSeconds: number;
};

/**
 * The researcher's side of a video response: whether to ask for one, what the
 * student should cover, and whether an application can go without it. Shared
 * by the one-page posting form and the edit wizard so both submit the same
 * fields to the same server helper.
 */
export function VideoRequestFields({
  initial,
  errors,
}: {
  initial: VideoRequestDraft;
  errors?: Record<string, string[] | undefined>;
}) {
  const [enabled, setEnabled] = useState(initial.enabled);
  const [prompt, setPrompt] = useState(initial.prompt);
  const lengths = VIDEO_LENGTH_OPTIONS.includes(initial.maxSeconds as (typeof VIDEO_LENGTH_OPTIONS)[number])
    ? VIDEO_LENGTH_OPTIONS
    : [...VIDEO_LENGTH_OPTIONS, initial.maxSeconds].sort((a, b) => a - b);

  return (
    <div className="flex flex-col gap-4">
      <label className="flex cursor-pointer items-start gap-2.5 rounded-[8px] border border-line bg-white px-3 py-2.5 transition-colors hover:border-ink/25 has-[:checked]:border-forest has-[:checked]:bg-moss/40">
        <input
          type="checkbox"
          name="videoResponseEnabled"
          value="true"
          checked={enabled}
          onChange={(event) => setEnabled(event.target.checked)}
          className="mt-0.5 size-4 shrink-0 accent-[#1d4436]"
        />
        <span className="min-w-0">
          <span className="flex items-center gap-1.5 text-[13.5px] text-ink">
            <Video className="size-3.5 text-forest" aria-hidden="true" />
            Ask applicants for a short video
          </span>
          <span className="mt-0.5 block text-[12px] leading-5 text-muted">
            Students record on Loom or upload to YouTube and paste the link. You watch it on their application.
          </span>
        </span>
      </label>

      {enabled ? (
        <div className="flex flex-col gap-4 rounded-[10px] border border-line bg-shell/50 p-4">
          <Field
            label="What should the video cover?"
            htmlFor="videoPrompt"
            required
            hint="Students see this exactly as written, on the listing and on the application."
            error={errors?.videoPrompt?.[0]}
          >
            <Textarea
              id="videoPrompt"
              name="videoPrompt"
              rows={3}
              maxLength={600}
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder={VIDEO_PROMPT_SUGGESTIONS[0]}
            />
          </Field>
          <div className="-mt-2">
            <p className="text-[11.5px] text-subtle">Start from one of these</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {VIDEO_PROMPT_SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => setPrompt(suggestion)}
                  aria-pressed={prompt === suggestion}
                  className="rounded-full border border-line-strong bg-white px-2.5 py-1 text-left text-[12px] leading-4 text-ink transition-colors hover:border-forest hover:bg-moss/50 aria-pressed:border-forest aria-pressed:bg-moss"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Target length" htmlFor="videoMaxSeconds" required error={errors?.videoMaxSeconds?.[0]}>
              <Select id="videoMaxSeconds" name="videoMaxSeconds" defaultValue={String(initial.maxSeconds)}>
                {lengths.map((seconds) => (
                  <option key={seconds} value={seconds}>
                    Up to {formatVideoLength(seconds)}
                  </option>
                ))}
              </Select>
            </Field>
            <fieldset className="flex flex-col gap-1.5">
              <legend className="mb-1.5 text-[13px] font-medium text-ink">Is the video required?</legend>
              <label className="flex cursor-pointer items-center gap-2 text-[13.5px] text-ink">
                <input
                  type="radio"
                  name="videoRequired"
                  value="true"
                  defaultChecked={initial.required}
                  className="size-4 accent-[#1d4436]"
                />
                Required to apply
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-[13.5px] text-ink">
                <input
                  type="radio"
                  name="videoRequired"
                  value="false"
                  defaultChecked={!initial.required}
                  className="size-4 accent-[#1d4436]"
                />
                Optional, students may skip it
              </label>
            </fieldset>
          </div>
          <p className="text-[12px] leading-5 text-subtle">
            ResearchBridge does not host or analyze the video. Nothing about a student&apos;s appearance, voice, or
            delivery is scored, and it does not change their fit figure.
          </p>
        </div>
      ) : null}
    </div>
  );
}
