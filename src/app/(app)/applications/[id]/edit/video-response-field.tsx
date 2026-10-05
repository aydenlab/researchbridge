"use client";

import { useState } from "react";
import { ExternalLink, Video } from "lucide-react";
import { VideoEmbed } from "@/components/app/video-embed";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/components/ui/cn";
import { Input } from "@/components/ui/field";
import {
  VIDEO_PROVIDER_LABELS,
  formatVideoLength,
  parseVideoLink,
  videoLinkProblem,
  type VideoProvider,
} from "@/lib/video-links";

const PROVIDERS: {
  value: VideoProvider;
  blurb: string;
  placeholder: string;
  start: { href: string; label: string };
  steps: string[];
}[] = [
  {
    value: "loom",
    blurb: "Record your camera and screen straight from the browser. The free plan is enough.",
    placeholder: "https://www.loom.com/share/…",
    start: { href: "https://www.loom.com/", label: "Open Loom" },
    steps: [
      "Record with Loom's browser extension or desktop app.",
      "Choose Share and make sure anyone with the link can view it.",
      "Choose Copy link and paste it below.",
    ],
  },
  {
    value: "youtube",
    blurb: "Upload a recording from your phone or computer. Set it to Unlisted so it stays off search.",
    placeholder: "https://youtu.be/…",
    start: { href: "https://www.youtube.com/upload", label: "Upload to YouTube" },
    steps: [
      "Upload the video and set its visibility to Unlisted. Private videos cannot be watched by the researcher.",
      "Once it has processed, choose Share on the video.",
      "Copy the link and paste it below.",
    ],
  },
];

/**
 * The student's half of a video response. They pick where the video lives,
 * get told how to produce a shareable link there, and see the video play here
 * once the link works, which is exactly how the researcher will see it.
 *
 * The link is the field that counts; the provider choice only shapes the
 * instructions, and follows whatever link is pasted.
 */
export function VideoResponseField({
  name,
  prompt,
  required,
  maxSeconds,
  researcherName,
  initialUrl,
  initialProvider,
  error,
}: {
  name: string;
  prompt: string;
  required: boolean;
  maxSeconds: number | null;
  researcherName: string;
  initialUrl: string | null;
  initialProvider: VideoProvider | null;
  error?: string;
}) {
  const [url, setUrl] = useState(initialUrl ?? "");
  const [chosen, setChosen] = useState<VideoProvider | null>(initialProvider);
  const [touched, setTouched] = useState(Boolean(initialUrl));

  const parsed = parseVideoLink(url);
  // A pasted link settles the question of where the video lives.
  const provider = parsed?.provider ?? chosen;
  const active = PROVIDERS.find((option) => option.value === provider) ?? null;
  const problem = touched ? videoLinkProblem(url, provider) : null;
  const shownError = problem ?? (parsed ? null : error);

  return (
    <section className="rounded-[12px] border border-line bg-white p-5" aria-labelledby={`${name}-heading`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2
          id={`${name}-heading`}
          className="inline-flex items-center gap-2 font-display text-[20px] text-ink"
          style={{ letterSpacing: "-0.4px" }}
        >
          <Video className="size-[18px] text-forest" aria-hidden="true" />
          Video response
        </h2>
        <span className="flex items-center gap-1.5">
          <Badge tone="outline">Up to {formatVideoLength(maxSeconds)}</Badge>
          <Badge tone={required ? "clay" : "neutral"}>{required ? "Required" : "Optional"}</Badge>
        </span>
      </div>

      <figure className="mt-4 rounded-[10px] border border-line bg-shell/60 px-4 py-3">
        <figcaption className="text-[12px] text-subtle">{researcherName} asks</figcaption>
        <blockquote className="mt-1 text-[15px] leading-7 text-ink">{prompt}</blockquote>
      </figure>

      <p className="mt-3 text-[13.5px] leading-6 text-muted">
        Record it wherever you are comfortable and share a link. Your video stays on Loom or YouTube and is never
        uploaded to ResearchBridge. Nothing about your appearance, voice, or delivery is analyzed or scored.
      </p>

      <fieldset className="mt-5">
        <legend className="mb-2 text-[13px] font-medium text-ink">Where is your video?</legend>
        <div className="grid gap-2.5 sm:grid-cols-2">
          {PROVIDERS.map((option) => (
            <label
              key={option.value}
              className={cn(
                "flex cursor-pointer items-start gap-2.5 rounded-[10px] border bg-white px-3.5 py-3 transition-colors hover:border-forest/40",
                provider === option.value ? "border-forest bg-moss/40" : "border-line",
              )}
            >
              <input
                type="radio"
                name={`${name}_provider`}
                value={option.value}
                checked={provider === option.value}
                onChange={() => setChosen(option.value)}
                className="mt-1 size-4 shrink-0 accent-[#1d4436]"
              />
              <span className="min-w-0">
                <span className="block text-[14px] font-medium text-ink">{VIDEO_PROVIDER_LABELS[option.value]}</span>
                <span className="mt-0.5 block text-[12.5px] leading-5 text-muted">{option.blurb}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {active ? (
        <div className="mt-4 rounded-[10px] border border-line bg-shell/40 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[12.5px] font-medium text-ink">Getting a link from {VIDEO_PROVIDER_LABELS[active.value]}</p>
            <a
              href={active.start.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[12.5px] text-forest underline decoration-line-strong underline-offset-4 hover:text-ink"
            >
              {active.start.label}
              <ExternalLink className="size-3" aria-hidden="true" />
            </a>
          </div>
          <ol className="mt-2 list-decimal pl-5 text-[13px] leading-6 text-muted">
            {active.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>
      ) : null}

      <div className="mt-4 flex flex-col gap-1.5">
        <label htmlFor={name} className="text-[13px] font-medium text-ink">
          Link to your video
          {required ? <span className="ml-1 text-clay">*</span> : <span className="ml-1.5 text-[11.5px] font-normal text-subtle">Optional</span>}
        </label>
        <Input
          id={name}
          name={name}
          type="text"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          placeholder={active?.placeholder ?? "Paste a Loom or YouTube link"}
          value={url}
          required={required}
          aria-invalid={shownError ? true : undefined}
          aria-describedby={shownError ? `${name}-error` : undefined}
          onChange={(event) => setUrl(event.target.value)}
          onBlur={() => setTouched(true)}
          onPaste={() => setTouched(true)}
        />
        {shownError ? (
          <p id={`${name}-error`} role="alert" className="text-[12.5px] text-bad">
            {shownError}
          </p>
        ) : null}
      </div>

      {parsed ? (
        <div className="mt-4">
          <p className="mb-2 text-[12.5px] text-muted">
            This is how {researcherName} will see it. If it does not play here, check the sharing settings on{" "}
            {VIDEO_PROVIDER_LABELS[parsed.provider]}.
          </p>
          <VideoEmbed key={parsed.embedUrl} video={parsed} title="Preview of your video response" />
        </div>
      ) : null}
    </section>
  );
}
