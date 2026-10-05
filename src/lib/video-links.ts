/**
 * Video responses are never hosted by ResearchBridge. A student records on
 * Loom or uploads to YouTube and pastes the share link; everything here turns
 * that link into something the review screen can embed.
 *
 * Pure functions with no server imports, so the application form can check a
 * link as it is pasted using the same rules the submit action applies.
 */

export const VIDEO_PROVIDERS = ["loom", "youtube"] as const;
export type VideoProvider = (typeof VIDEO_PROVIDERS)[number];

export const VIDEO_PROVIDER_LABELS: Record<VideoProvider, string> = {
  loom: "Loom",
  youtube: "YouTube",
};

export type VideoLink = {
  provider: VideoProvider;
  id: string;
  /** The share address, rebuilt from the id so tracking parameters are dropped. */
  url: string;
  embedUrl: string;
};

/** What an answer row stores in `structuredAnswer` for a video question. */
export type VideoAnswer = {
  provider?: VideoProvider | null;
  externalUrl?: string | null;
  videoId?: string | null;
};

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
// Loom ids are 32 hex characters. Newer share links put a title slug in front
// of the id ("my-intro-0281766f…"), so the id is read off the end of the path.
const LOOM_ID = /([0-9a-f]{32})$/i;

const YOUTUBE_HOSTS = new Set(["youtube.com", "m.youtube.com", "youtube-nocookie.com"]);
const LOOM_HOSTS = new Set(["loom.com"]);

function toUrl(raw: string): URL | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withScheme);
    return url.protocol === "https:" || url.protocol === "http:" ? url : null;
  } catch {
    return null;
  }
}

function hostOf(url: URL) {
  return url.hostname.toLowerCase().replace(/^www\./, "");
}

function youtubeId(url: URL): string | null {
  const host = hostOf(url);
  if (host === "youtu.be") {
    const id = url.pathname.split("/")[1] ?? "";
    return YOUTUBE_ID.test(id) ? id : null;
  }
  if (!YOUTUBE_HOSTS.has(host)) return null;

  if (url.pathname === "/watch") {
    const id = url.searchParams.get("v") ?? "";
    return YOUTUBE_ID.test(id) ? id : null;
  }
  const [, kind, id = ""] = url.pathname.split("/");
  if (["shorts", "embed", "live", "v"].includes(kind ?? "") && YOUTUBE_ID.test(id)) return id;
  return null;
}

function loomId(url: URL): string | null {
  if (!LOOM_HOSTS.has(hostOf(url))) return null;
  const [, kind, slug = ""] = url.pathname.split("/");
  if (kind !== "share" && kind !== "embed") return null;
  return slug.match(LOOM_ID)?.[1]?.toLowerCase() ?? null;
}

/** Reads a pasted Loom or YouTube link. Anything else, including a channel or playlist, is null. */
export function parseVideoLink(raw: string | null | undefined): VideoLink | null {
  if (!raw) return null;
  const url = toUrl(raw);
  if (!url) return null;

  const yt = youtubeId(url);
  if (yt) {
    return {
      provider: "youtube",
      id: yt,
      url: `https://www.youtube.com/watch?v=${yt}`,
      embedUrl: `https://www.youtube-nocookie.com/embed/${yt}?rel=0`,
    };
  }

  const loom = loomId(url);
  if (loom) {
    return {
      provider: "loom",
      id: loom,
      url: `https://www.loom.com/share/${loom}`,
      embedUrl: `https://www.loom.com/embed/${loom}?hideEmbedTopBar=true`,
    };
  }

  return null;
}

export function isVideoProvider(value: unknown): value is VideoProvider {
  return typeof value === "string" && (VIDEO_PROVIDERS as readonly string[]).includes(value);
}

/** Reads a stored answer back into an embeddable link, or null when there is nothing usable. */
export function videoFromAnswer(structured: unknown): VideoLink | null {
  if (!structured || typeof structured !== "object") return null;
  return parseVideoLink((structured as VideoAnswer).externalUrl ?? null);
}

/** The message shown when a pasted link cannot be used, named for the provider the student picked. */
export function videoLinkProblem(raw: string, chosen: VideoProvider | null): string | null {
  if (!raw.trim()) return null;
  if (parseVideoLink(raw)) return null;
  if (chosen === "loom") return "That is not a Loom share link. In Loom, choose Share, then Copy link, and paste it here.";
  if (chosen === "youtube") {
    return "That is not a YouTube video link. Open the video on YouTube, choose Share, and paste the link it gives you.";
  }
  return "Paste a Loom or YouTube video link. Other sites cannot be shown to the researcher.";
}

/** Length choices offered to researchers, in seconds. */
export const VIDEO_LENGTH_OPTIONS = [30, 60, 90, 120, 180, 300] as const;

export function formatVideoLength(seconds: number | null | undefined): string {
  const value = seconds ?? 60;
  const minutes = value / 60;
  if (value < 60 || !Number.isInteger(minutes)) return `${value} seconds`;
  return minutes === 1 ? "1 minute" : `${minutes} minutes`;
}

/** Starting points a researcher can drop into the prompt and then edit. */
export const VIDEO_PROMPT_SUGGESTIONS = [
  "Introduce yourself and tell us why you want to join this project specifically.",
  "What relevant skills or experience would you bring to this project?",
  "Describe a problem you worked through recently and what you would do differently now.",
] as const;

/**
 * A video question outlives the request that created it, so answers already
 * sent are kept when a researcher switches video off. These drop it from what
 * students are asked whenever the request is not live.
 */
export function visibleQuestions<Q extends { type: string }>(questions: Q[], videoEnabled: boolean): Q[] {
  return videoEnabled ? questions : questions.filter((question) => question.type !== "video_response");
}

/** Splits the video question out of the written ones, which are numbered and shown separately. */
export function splitVideoQuestion<Q extends { type: string }>(questions: Q[]): { video: Q | null; written: Q[] } {
  return {
    video: questions.find((question) => question.type === "video_response") ?? null,
    written: questions.filter((question) => question.type !== "video_response"),
  };
}
