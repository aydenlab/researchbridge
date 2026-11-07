"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink, Trash2, Upload, Video } from "lucide-react";
import { VideoEmbed } from "@/components/app/video-embed";
import { VideoFilePlayer } from "@/components/app/video-file-player";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { Input } from "@/components/ui/field";
import {
  VIDEO_SNIFF_BYTES,
  VIDEO_TOO_LARGE_MESSAGE,
  VIDEO_TYPE_MESSAGE,
  VIDEO_UPLOAD_ACCEPT,
  VIDEO_UPLOAD_MAX_BYTES,
  formatFileSize,
  sniffVideoType,
} from "@/lib/video-files";
import {
  VIDEO_FILE_SOURCE,
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

type Source = VideoProvider | typeof VIDEO_FILE_SOURCE;
export type UploadedVideo = { id: string; fileName: string; byteSize: number };

/**
 * The student's half of a video response. They pick where the video lives, and
 * see it play here once it works, which is exactly how the researcher will see it.
 *
 * With a link, the link is the field that counts, and the provider choice only
 * shapes the instructions. A file goes up on its own as soon as it is chosen,
 * since sending it with every draft save would mean re-sending a video each time.
 */
export function VideoResponseField({
  applicationId,
  name,
  prompt,
  required,
  maxSeconds,
  researcherName,
  initialUrl,
  initialProvider,
  initialFile,
  error,
  onUploadingChange,
}: {
  applicationId: string;
  name: string;
  prompt: string;
  required: boolean;
  maxSeconds: number | null;
  researcherName: string;
  initialUrl: string | null;
  initialProvider: Source | null;
  initialFile: UploadedVideo | null;
  error?: string;
  /** So the form can hold back submitting an application whose video is still on its way. */
  onUploadingChange?: (uploading: boolean) => void;
}) {
  const [url, setUrl] = useState(initialUrl ?? "");
  const [chosen, setChosen] = useState<Source | null>(initialFile ? VIDEO_FILE_SOURCE : initialProvider);
  const [touched, setTouched] = useState(Boolean(initialUrl));
  const [file, setFile] = useState<UploadedVideo | null>(initialFile);
  const [progress, setProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const request = useRef<XMLHttpRequest | null>(null);
  const picker = useRef<HTMLInputElement>(null);

  const uploading = progress !== null;
  useEffect(() => {
    onUploadingChange?.(uploading);
    if (!uploading) return;
    // A file half way up is lost if the page goes away, so ask first.
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [uploading, onUploadingChange]);

  const parsed = parseVideoLink(url);
  const usingFile = chosen === VIDEO_FILE_SOURCE;
  // A pasted link settles the question of where the video lives.
  const provider: Source | null = usingFile ? VIDEO_FILE_SOURCE : (parsed?.provider ?? chosen);
  const active = PROVIDERS.find((option) => option.value === provider) ?? null;
  const problem = touched && !usingFile ? videoLinkProblem(url, usingFile ? null : (provider as VideoProvider | null)) : null;
  const shownError = usingFile ? (file ? null : error) : (problem ?? (parsed ? null : error));

  async function upload(chosenFile: File) {
    setUploadError(null);
    if (chosenFile.size > VIDEO_UPLOAD_MAX_BYTES) {
      setUploadError(VIDEO_TOO_LARGE_MESSAGE);
      return;
    }
    // Refuse here what the server would refuse, rather than after minutes of sending it.
    const head = new Uint8Array(await chosenFile.slice(0, VIDEO_SNIFF_BYTES).arrayBuffer());
    if (!sniffVideoType(head)) {
      setUploadError(chosenFile.size === 0 ? "That file is empty. Choose a different file." : VIDEO_TYPE_MESSAGE);
      return;
    }

    const xhr = new XMLHttpRequest();
    request.current = xhr;
    xhr.open("PUT", `/api/applications/${applicationId}/video`);
    xhr.setRequestHeader("X-File-Name", encodeURIComponent(chosenFile.name));
    xhr.setRequestHeader("Content-Type", "application/octet-stream");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) setProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      request.current = null;
      setProgress(null);
      let body: { ok?: boolean; error?: string; file?: UploadedVideo } | null = null;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        // A proxy's error page, not ours. Handled as a failure below.
      }
      if (xhr.status === 200 && body?.file) {
        setFile(body.file);
        setUrl("");
      } else {
        setUploadError(body?.error ?? "The upload did not finish. Check your connection and try again.");
      }
    };
    xhr.onerror = () => {
      request.current = null;
      setProgress(null);
      setUploadError("The upload did not finish. Check your connection and try again.");
    };
    xhr.onabort = () => {
      request.current = null;
      setProgress(null);
    };
    setProgress(0);
    xhr.send(chosenFile);
  }

  async function remove() {
    setUploadError(null);
    try {
      const response = await fetch(`/api/applications/${applicationId}/video`, { method: "DELETE" });
      if (!response.ok) throw new Error(String(response.status));
      setFile(null);
    } catch {
      setUploadError("That video could not be removed. Try again.");
    }
  }

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
        Record it wherever you are comfortable, then upload the file or share a link. Nothing about your appearance,
        voice, or delivery is analyzed or scored.
      </p>

      <fieldset className="mt-5">
        <legend className="mb-2 text-[13px] font-medium text-ink">How are you sending your video?</legend>
        <div className="grid gap-2.5 sm:grid-cols-3">
          <label
            className={cn(
              "flex cursor-pointer items-start gap-2.5 rounded-[10px] border bg-white px-3.5 py-3 transition-colors hover:border-forest/40",
              usingFile ? "border-forest bg-moss/40" : "border-line",
            )}
          >
            <input
              type="radio"
              name={`${name}_provider`}
              value={VIDEO_FILE_SOURCE}
              checked={usingFile}
              disabled={uploading}
              onChange={() => setChosen(VIDEO_FILE_SOURCE)}
              className="mt-1 size-4 shrink-0 accent-[#1d4436]"
            />
            <span className="min-w-0">
              <span className="block text-[14px] font-medium text-ink">Upload a file</span>
              <span className="mt-0.5 block text-[12.5px] leading-5 text-muted">
                From your phone or computer. MP4, MOV, or WebM, up to {formatFileSize(VIDEO_UPLOAD_MAX_BYTES)}.
              </span>
            </span>
          </label>
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
                disabled={uploading}
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

      {usingFile ? (
        <div className="mt-4">
          {/* No name on this input: the file goes up by itself and must never travel with the form. */}
          <input
            ref={picker}
            id={`${name}-file`}
            type="file"
            accept={VIDEO_UPLOAD_ACCEPT}
            aria-label="Choose a video file"
            className="sr-only"
            onChange={(event) => {
              const picked = event.target.files?.[0];
              event.target.value = "";
              if (picked) void upload(picked);
            }}
          />

          {uploading ? (
            <div className="rounded-[10px] border border-line bg-shell/40 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[13px] text-ink" aria-live="polite">
                  {progress === 100 ? "Almost done, saving your video" : `Uploading your video, ${progress} percent`}
                </p>
                <Button type="button" variant="outline" size="sm" onClick={() => request.current?.abort()}>
                  Cancel
                </Button>
              </div>
              <div
                role="progressbar"
                aria-label="Video upload progress"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress ?? 0}
                className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-line"
              >
                <div className="h-full rounded-full bg-forest transition-[width]" style={{ width: `${progress}%` }} />
              </div>
              <p className="mt-2 text-[12px] text-subtle">Keep this page open until it finishes.</p>
            </div>
          ) : file ? (
            <div>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="min-w-0 break-all text-[13px] text-ink">
                  {file.fileName} <span className="text-subtle">({formatFileSize(file.byteSize)})</span>
                </p>
                <span className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => picker.current?.click()}>
                    Replace
                  </Button>
                  <Button type="button" variant="danger" size="sm" onClick={() => void remove()}>
                    <Trash2 aria-hidden="true" />
                    Remove
                  </Button>
                </span>
              </div>
              <p className="mb-2 text-[12.5px] text-muted">This is how {researcherName} will see it.</p>
              <VideoFilePlayer key={file.id} fileId={file.id} title="Preview of your video response" />
            </div>
          ) : (
            <div className="rounded-[10px] border border-dashed border-line-strong bg-shell/40 px-4 py-5 text-center">
              <Button type="button" variant="outline" onClick={() => picker.current?.click()}>
                <Upload aria-hidden="true" />
                Choose a video file
              </Button>
              <p className="mt-2.5 text-[12.5px] leading-5 text-muted">
                Only {researcherName} and ResearchBridge administrators can watch it. If yours is larger than{" "}
                {formatFileSize(VIDEO_UPLOAD_MAX_BYTES)}, share a Loom or YouTube link instead.
              </p>
              {parsed ? (
                <p className="mt-1.5 text-[12.5px] leading-5 text-muted">
                  Your {VIDEO_PROVIDER_LABELS[parsed.provider]} link stays attached unless you upload a file, which replaces it.
                </p>
              ) : null}
            </div>
          )}

          {uploadError || shownError ? (
            <p id={`${name}-error`} role="alert" className="mt-2 text-[12.5px] text-bad">
              {uploadError ?? shownError}
            </p>
          ) : null}
        </div>
      ) : null}

      {!usingFile && active ? (
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

      {!usingFile ? (
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
            required={required && !file}
            aria-invalid={shownError ? true : undefined}
            aria-describedby={shownError ? `${name}-error` : undefined}
            onChange={(event) => {
              setUrl(event.target.value);
              // A working link replaces the upload. Do it now rather than at the next
              // autosave, so what this page shows and what is stored never disagree.
              if (file && parseVideoLink(event.target.value)) void remove();
            }}
            onBlur={() => setTouched(true)}
            onPaste={() => setTouched(true)}
          />
          {shownError ? (
            <p id={`${name}-error`} role="alert" className="text-[12.5px] text-bad">
              {shownError}
            </p>
          ) : null}
          {file && !parsed ? (
            <p className="text-[12.5px] leading-5 text-muted">
              Your uploaded video, {file.fileName}, stays attached unless you paste a link here, which replaces it.
            </p>
          ) : null}
        </div>
      ) : null}

      {!usingFile && parsed ? (
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
