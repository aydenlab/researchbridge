import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, storedFiles } from "@/db";
import { FILE_RULES, storage, storeFile } from "@/lib/storage";
import { createStudent } from "../fixtures";

function fakeFile(name: string, type: string, bytes: number) {
  return new File([new Uint8Array(bytes)], name, { type });
}

/**
 * The framework rejects an oversized server-action body before any of our own
 * validation runs, so a bodySizeLimit below the largest rule silently breaks
 * the upload no matter what the rule says.
 */
describe("upload limits line up with the server action limit", () => {
  it("allows every declared file rule through the configured body limit", () => {
    const config = readFileSync(join(process.cwd(), "next.config.ts"), "utf8");
    const match = config.match(/bodySizeLimit:\s*"(\d+)mb"/);
    expect(match).not.toBeNull();

    const limitBytes = Number(match![1]) * 1024 * 1024;
    const largest = Math.max(...Object.values(FILE_RULES).map((rule) => rule.maxBytes));
    expect(limitBytes).toBeGreaterThanOrEqual(largest);
  });
});

describe("storing a video introduction", () => {
  it("accepts an mp4 and reads the bytes back", async () => {
    const student = await createStudent();
    const stored = await storeFile({
      file: fakeFile("intro.mp4", "video/mp4", 2048),
      purpose: "video",
      ownerId: student.id,
    });

    expect(stored.byteSize).toBe(2048);

    const [row] = await db.select().from(storedFiles).where(eq(storedFiles.id, stored.id)).limit(1);
    expect(row.purpose).toBe("video");
    expect(row.contentType).toBe("video/mp4");

    const body = await storage().get(row.storageKey);
    expect(body?.length).toBe(2048);
  });

  it("accepts webm too", async () => {
    const student = await createStudent();
    await expect(
      storeFile({ file: fakeFile("intro.webm", "video/webm", 1024), purpose: "video", ownerId: student.id }),
    ).resolves.toBeTruthy();
  });

  it("refuses a video that is not a video", async () => {
    const student = await createStudent();
    await expect(
      storeFile({ file: fakeFile("intro.pdf", "application/pdf", 1024), purpose: "video", ownerId: student.id }),
    ).rejects.toThrow(/not accepted/i);
  });

  it("refuses a video past the 60 MB rule", async () => {
    const student = await createStudent();
    const tooBig = FILE_RULES.video.maxBytes + 1;
    await expect(
      storeFile({ file: fakeFile("huge.mp4", "video/mp4", tooBig), purpose: "video", ownerId: student.id }),
    ).rejects.toThrow(/larger than/i);
  });
});

describe("storing a writing sample", () => {
  it("accepts a PDF and reads it back", async () => {
    const student = await createStudent();
    const stored = await storeFile({
      file: fakeFile("essay.pdf", "application/pdf", 4096),
      purpose: "paper",
      ownerId: student.id,
    });

    const [row] = await db.select().from(storedFiles).where(eq(storedFiles.id, stored.id)).limit(1);
    expect(row.purpose).toBe("paper");
    const body = await storage().get(row.storageKey);
    expect(body?.length).toBe(4096);
  });

  it("refuses a non-PDF writing sample", async () => {
    const student = await createStudent();
    await expect(
      storeFile({ file: fakeFile("essay.docx", "application/msword", 1024), purpose: "paper", ownerId: student.id }),
    ).rejects.toThrow(/not accepted/i);
  });

  it("refuses an empty file", async () => {
    const student = await createStudent();
    await expect(
      storeFile({ file: fakeFile("empty.pdf", "application/pdf", 0), purpose: "paper", ownerId: student.id }),
    ).rejects.toThrow(/empty/i);
  });
});
