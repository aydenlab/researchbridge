"use client";

import { useState } from "react";
import { Download } from "lucide-react";

/**
 * Plays a video uploaded with an application, from ResearchBridge's own file
 * route, so the same access checks apply to every byte of it. Browsers disagree
 * about codecs (an iPhone's HEVC .mov will not play in every browser), so a video
 * that cannot be decoded here says so and offers the file itself.
 */
export function VideoFilePlayer({ fileId, title }: { fileId: string; title: string }) {
  const [failed, setFailed] = useState(false);
  const src = `/api/files/by-id/${fileId}`;

  return (
    <div className="flex flex-col gap-2">
      {failed ? (
        <p role="status" className="rounded-[10px] border border-line bg-shell/60 px-4 py-3 text-[13.5px] leading-6 text-muted">
          This browser cannot play this video here. Download it to watch it.
        </p>
      ) : (
        <video
          src={src}
          title={title}
          aria-label={title}
          controls
          playsInline
          preload="metadata"
          onError={() => setFailed(true)}
          className="aspect-video w-full rounded-[10px] border border-line bg-ink/90"
        />
      )}
      <a
        href={src}
        download
        className="inline-flex w-fit items-center gap-1.5 text-[12.5px] text-forest underline decoration-line-strong underline-offset-4 hover:text-ink"
      >
        Download the video
        <Download className="size-3" aria-hidden="true" />
      </a>
    </div>
  );
}
