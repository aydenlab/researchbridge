/**
 * Rules for a video uploaded with an application. Pure, with no server imports,
 * so the application form can refuse a file before spending minutes sending it,
 * using the same checks the upload route applies to the bytes it receives.
 */

/** Roughly two minutes of phone footage. Past that a Loom or YouTube link is the better answer. */
export const VIDEO_UPLOAD_MAX_BYTES = 200 * 1024 * 1024;

export const VIDEO_UPLOAD_ACCEPT = "video/mp4,video/quicktime,video/webm,.mp4,.m4v,.mov,.webm";

/** How much of the start of a file the type check needs to see. */
export const VIDEO_SNIFF_BYTES = 12;

export type UploadedVideoType = "video/mp4" | "video/quicktime" | "video/webm";

// `ftyp` also opens HEIC photos, AVIF images, and M4A audio, none of which play here.
const NON_VIDEO_BRANDS = new Set(["heic", "heix", "hevc", "hevx", "mif1", "msf1", "avif", "avis", "M4A ", "M4B ", "M4P "]);
// QuickTime files from older cameras can open with one of these instead of `ftyp`.
const QUICKTIME_ATOMS = new Set(["moov", "mdat", "wide", "free", "skip"]);

function ascii(bytes: Uint8Array, start: number, end: number) {
  return String.fromCharCode(...bytes.subarray(start, end));
}

/**
 * Reads what a file really is from its first bytes. The name and the type a
 * browser reports are both the uploader's say-so, and this type is what the file
 * is later served as, so neither is trusted. Null means not a video this can play.
 */
export function sniffVideoType(bytes: Uint8Array): UploadedVideoType | null {
  if (bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
    return "video/webm";
  }
  if (bytes.length < VIDEO_SNIFF_BYTES) return null;

  const atom = ascii(bytes, 4, 8);
  if (atom === "ftyp") {
    const brand = ascii(bytes, 8, 12);
    if (NON_VIDEO_BRANDS.has(brand)) return null;
    return brand === "qt  " ? "video/quicktime" : "video/mp4";
  }
  return QUICKTIME_ATOMS.has(atom) ? "video/quicktime" : null;
}

export function formatFileSize(bytes: number): string {
  const megabytes = bytes / (1024 * 1024);
  if (megabytes >= 10) return `${Math.round(megabytes)} MB`;
  if (megabytes >= 1) return `${megabytes.toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export const VIDEO_TOO_LARGE_MESSAGE = `That video is larger than the ${formatFileSize(VIDEO_UPLOAD_MAX_BYTES)} limit. Compress it, or share it as a Loom or YouTube link instead.`;
export const VIDEO_TYPE_MESSAGE =
  "That file is not a video this can play. Upload an MP4, MOV, or WebM, or share a Loom or YouTube link instead.";
