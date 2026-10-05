import { ExternalLink } from "lucide-react";
import { VIDEO_PROVIDER_LABELS, type VideoLink } from "@/lib/video-links";

/**
 * Plays a Loom or YouTube response in place. The video stays on the provider;
 * this only frames it, with a plain link underneath for anyone whose browser
 * blocks the player or who would rather watch it full size.
 */
export function VideoEmbed({ video, title }: { video: VideoLink; title: string }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="relative aspect-video w-full overflow-hidden rounded-[10px] border border-line bg-ink/90">
        <iframe
          src={video.embedUrl}
          title={title}
          className="absolute inset-0 size-full"
          allow="encrypted-media; fullscreen; picture-in-picture"
          allowFullScreen
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
      <a
        href={video.url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex w-fit items-center gap-1.5 text-[12.5px] text-forest underline decoration-line-strong underline-offset-4 hover:text-ink"
      >
        Open on {VIDEO_PROVIDER_LABELS[video.provider]}
        <ExternalLink className="size-3" aria-hidden="true" />
      </a>
    </div>
  );
}
