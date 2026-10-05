import { describe, expect, it } from "vitest";
import {
  formatVideoLength,
  parseVideoLink,
  splitVideoQuestion,
  videoFromAnswer,
  videoLinkProblem,
  visibleQuestions,
} from "@/lib/video-links";

const LOOM = "0281766fa2d04bb788eaf19e65135184";
const YT = "dQw4w9WgXcQ";

describe("reading a pasted video link", () => {
  it.each([
    `https://www.youtube.com/watch?v=${YT}`,
    `https://youtube.com/watch?v=${YT}&t=42s&si=tracking`,
    `https://m.youtube.com/watch?v=${YT}`,
    `https://youtu.be/${YT}`,
    `https://youtu.be/${YT}?si=abc`,
    `https://www.youtube.com/shorts/${YT}`,
    `https://www.youtube.com/embed/${YT}`,
    `https://www.youtube.com/live/${YT}`,
    `https://www.youtube-nocookie.com/embed/${YT}`,
    `youtu.be/${YT}`,
    `  https://youtu.be/${YT}  `,
  ])("reads %s as a YouTube video", (raw) => {
    const link = parseVideoLink(raw);
    expect(link).toEqual({
      provider: "youtube",
      id: YT,
      url: `https://www.youtube.com/watch?v=${YT}`,
      embedUrl: `https://www.youtube-nocookie.com/embed/${YT}?rel=0`,
    });
  });

  it.each([
    `https://www.loom.com/share/${LOOM}`,
    `https://loom.com/share/${LOOM}?sid=1234`,
    `https://www.loom.com/share/My-intro-for-the-cardiology-lab-${LOOM}`,
    `https://www.loom.com/embed/${LOOM}`,
    `https://www.loom.com/share/${LOOM.toUpperCase()}`,
    `loom.com/share/${LOOM}`,
  ])("reads %s as a Loom video", (raw) => {
    const link = parseVideoLink(raw);
    expect(link?.provider).toBe("loom");
    expect(link?.id).toBe(LOOM);
    expect(link?.url).toBe(`https://www.loom.com/share/${LOOM}`);
    expect(link?.embedUrl).toContain(`https://www.loom.com/embed/${LOOM}`);
  });

  it.each([
    "",
    "not a link",
    "https://vimeo.com/123456",
    "https://www.youtube.com/@somechannel",
    "https://www.youtube.com/playlist?list=PL1234",
    "https://www.youtube.com/watch?v=short",
    "https://www.loom.com/share/",
    "https://www.loom.com/looms/videos",
    `https://evil.example/share/${LOOM}`,
    `https://notyoutube.com/watch?v=${YT}`,
    `javascript:alert(1)//youtu.be/${YT}`,
    `ftp://youtu.be/${YT}`,
  ])("refuses %s", (raw) => {
    expect(parseVideoLink(raw)).toBeNull();
  });
});

describe("explaining a link that cannot be used", () => {
  it("says nothing about an empty field or a good link", () => {
    expect(videoLinkProblem("", "loom")).toBeNull();
    expect(videoLinkProblem(`https://youtu.be/${YT}`, "loom")).toBeNull();
  });

  it("names the provider the student chose", () => {
    expect(videoLinkProblem("https://vimeo.com/1", "loom")).toMatch(/Loom/);
    expect(videoLinkProblem("https://vimeo.com/1", "youtube")).toMatch(/YouTube/);
    expect(videoLinkProblem("https://vimeo.com/1", null)).toMatch(/Loom or YouTube/);
  });
});

describe("stored answers and questions", () => {
  it("rebuilds an embeddable link from what was stored", () => {
    expect(videoFromAnswer({ provider: "youtube", externalUrl: `https://www.youtube.com/watch?v=${YT}` })?.id).toBe(YT);
    expect(videoFromAnswer({ externalUrl: "https://vimeo.com/1" })).toBeNull();
    expect(videoFromAnswer(null)).toBeNull();
  });

  it("hides a video question once the request is switched off", () => {
    const questions = [{ type: "long_text" }, { type: "video_response" }];
    expect(visibleQuestions(questions, true)).toHaveLength(2);
    expect(visibleQuestions(questions, false)).toEqual([{ type: "long_text" }]);
  });

  it("splits the video out of the numbered questions", () => {
    const { video, written } = splitVideoQuestion([{ type: "long_text" }, { type: "video_response" }, { type: "yes_no" }]);
    expect(video).toEqual({ type: "video_response" });
    expect(written.map((question) => question.type)).toEqual(["long_text", "yes_no"]);
  });

  it("describes lengths in words", () => {
    expect(formatVideoLength(30)).toBe("30 seconds");
    expect(formatVideoLength(60)).toBe("1 minute");
    expect(formatVideoLength(120)).toBe("2 minutes");
    expect(formatVideoLength(90)).toBe("90 seconds");
    expect(formatVideoLength(null)).toBe("1 minute");
  });
});
