import { describe, expect, it } from "vitest";
import { Readable } from "node:stream";
import { lazyWebStream, parseByteRange } from "@/lib/storage/range";
import { formatFileSize, sniffVideoType, VIDEO_UPLOAD_MAX_BYTES } from "@/lib/video-files";
import { readVideoResponse } from "@/lib/video-links";

function bytes(...parts: (string | number[])[]) {
  const out: number[] = [];
  for (const part of parts) {
    if (typeof part === "string") out.push(...[...part].map((char) => char.charCodeAt(0)));
    else out.push(...part);
  }
  return new Uint8Array(out);
}

const SIZE = [0, 0, 0, 0x20];

describe("reading what a video really is from its bytes", () => {
  it("recognises the formats phones and browsers produce", () => {
    expect(sniffVideoType(bytes(SIZE, "ftypisom", SIZE))).toBe("video/mp4");
    expect(sniffVideoType(bytes(SIZE, "ftypmp42", SIZE))).toBe("video/mp4");
    expect(sniffVideoType(bytes(SIZE, "ftypqt  ", SIZE))).toBe("video/quicktime");
    expect(sniffVideoType(bytes(SIZE, "moov", SIZE, SIZE))).toBe("video/quicktime");
    expect(sniffVideoType(bytes([0x1a, 0x45, 0xdf, 0xa3, 0x01, 0, 0, 0, 0, 0, 0, 0]))).toBe("video/webm");
  });

  it("refuses files that only claim to be video", () => {
    expect(sniffVideoType(bytes("%PDF-1.7 not a video"))).toBeNull();
    expect(sniffVideoType(bytes("<html><script>alert(1)</script>"))).toBeNull();
    expect(sniffVideoType(new Uint8Array(32))).toBeNull();
  });

  it("does not mistake a photo or audio file sharing the same container for a video", () => {
    expect(sniffVideoType(bytes(SIZE, "ftypheic", SIZE))).toBeNull();
    expect(sniffVideoType(bytes(SIZE, "ftypavif", SIZE))).toBeNull();
    expect(sniffVideoType(bytes(SIZE, "ftypM4A ", SIZE))).toBeNull();
  });

  it("does not guess from too few bytes", () => {
    expect(sniffVideoType(bytes(SIZE, "ftyp"))).toBeNull();
  });
});

describe("answering a Range request", () => {
  it("sends the whole file when none is asked for or the form is not handled", () => {
    expect(parseByteRange(null, 100)).toBeNull();
    expect(parseByteRange("items=0-5", 100)).toBeNull();
    expect(parseByteRange("bytes=0-1,5-6", 100)).toBeNull();
    expect(parseByteRange("bytes=-", 100)).toBeNull();
  });

  it("reads open-ended and bounded ranges", () => {
    expect(parseByteRange("bytes=0-", 100)).toEqual({ start: 0, end: 99 });
    expect(parseByteRange("bytes=10-19", 100)).toEqual({ start: 10, end: 19 });
  });

  it("clamps a range running past the end, which is how players ask", () => {
    expect(parseByteRange("bytes=90-5000", 100)).toEqual({ start: 90, end: 99 });
  });

  it("reads a suffix as the last bytes of the file", () => {
    expect(parseByteRange("bytes=-10", 100)).toEqual({ start: 90, end: 99 });
    expect(parseByteRange("bytes=-500", 100)).toEqual({ start: 0, end: 99 });
  });

  it("calls a range that cannot be met unsatisfiable", () => {
    expect(parseByteRange("bytes=100-", 100)).toBe("unsatisfiable");
    expect(parseByteRange("bytes=50-40", 100)).toBe("unsatisfiable");
    expect(parseByteRange("bytes=-0", 100)).toBe("unsatisfiable");
  });
});

describe("a response body that opens its file late", () => {
  it("opens nothing for a body that is never read, as with HEAD or an early hang-up", async () => {
    let opened = 0;
    lazyWebStream(() => {
      opened += 1;
      return Readable.from([Buffer.from("x")]);
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(opened).toBe(0);
  });

  it("delivers every byte when read, once", async () => {
    let opened = 0;
    const body = lazyWebStream(() => {
      opened += 1;
      return Readable.from([Buffer.from("he"), Buffer.from("llo")]);
    });
    expect(await new Response(body).text()).toBe("hello");
    expect(opened).toBe(1);
  });

  it("closes the source when a reader cancels part way", async () => {
    const source = new Readable({
      read() {
        this.push(Buffer.from("chunk"));
      },
    });
    const reader = lazyWebStream(() => source).getReader();
    await reader.read();
    await reader.cancel();
    expect(source.destroyed).toBe(true);
  });
});

describe("reading a stored video answer", () => {
  const youtube = { provider: "youtube", externalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", videoId: "dQw4w9WgXcQ" };

  it("treats no answer, and an empty one, as nothing sent", () => {
    expect(readVideoResponse(undefined)).toBeNull();
    expect(readVideoResponse({ structuredAnswer: null, fileId: null })).toBeNull();
    expect(readVideoResponse({ structuredAnswer: { provider: "file", externalUrl: null }, fileId: null })).toBeNull();
  });

  it("tells an uploaded file from a link from a link that cannot play", () => {
    expect(readVideoResponse({ structuredAnswer: { provider: "file" }, fileId: "abc" })).toEqual({ kind: "file", fileId: "abc" });
    expect(readVideoResponse({ structuredAnswer: youtube, fileId: null })?.kind).toBe("link");
    expect(readVideoResponse({ structuredAnswer: { externalUrl: "https://vimeo.com/1" }, fileId: null })).toEqual({
      kind: "unplayable",
      url: "https://vimeo.com/1",
    });
  });
});

describe("file sizes", () => {
  it("reads naturally at the sizes students see", () => {
    expect(formatFileSize(VIDEO_UPLOAD_MAX_BYTES)).toBe("200 MB");
    expect(formatFileSize(5.5 * 1024 * 1024)).toBe("5.5 MB");
    expect(formatFileSize(2048)).toBe("2 KB");
  });
});
