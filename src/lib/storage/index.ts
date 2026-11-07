import crypto from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { eq } from "drizzle-orm";
import { db, storedFiles } from "@/db";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { log } from "@/lib/log";
import {
  VIDEO_SNIFF_BYTES,
  VIDEO_TOO_LARGE_MESSAGE,
  VIDEO_TYPE_MESSAGE,
  VIDEO_UPLOAD_MAX_BYTES,
  sniffVideoType,
  type UploadedVideoType,
} from "@/lib/video-files";
import type { StorageProvider } from "./types";

export const FILE_RULES = {
  resume: { maxBytes: 8 * 1024 * 1024, types: ["application/pdf"] },
  transcript: { maxBytes: 8 * 1024 * 1024, types: ["application/pdf"] },
  attachment: { maxBytes: 12 * 1024 * 1024, types: ["application/pdf", "image/png", "image/jpeg", "text/plain"] },
  paper: { maxBytes: 20 * 1024 * 1024, types: ["application/pdf"] },
  photo: { maxBytes: 4 * 1024 * 1024, types: ["image/png", "image/jpeg", "image/webp"] },
  video: { maxBytes: 60 * 1024 * 1024, types: ["video/webm", "video/mp4"] },
} as const;

export type FilePurpose = keyof typeof FILE_RULES;

/**
 * Deliberately not in FILE_RULES, whose entries travel through a server action
 * and are capped by its body limit. These go through the streaming upload route.
 */
export const APPLICATION_VIDEO_PURPOSE = "application_video";

const localRoot = path.join(process.cwd(), ".storage");

const localProvider: StorageProvider = {
  name: "local",
  async put({ key, body }) {
    const target = path.join(localRoot, key);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, body);
  },
  async putStream({ key, stages }) {
    const target = path.join(localRoot, key);
    await fs.mkdir(path.dirname(target), { recursive: true });
    // One pipeline over every stage, so that a client hanging up fails the write
    // rather than leaving it waiting, and a refused file stops the read. Nothing
    // may flow before this point: a stage failing with no listener would crash the process.
    await pipeline([...stages, createWriteStream(target)]);
  },
  async get(key) {
    try {
      return await fs.readFile(path.join(localRoot, key));
    } catch {
      return null;
    }
  },
  async open(key) {
    const target = path.join(localRoot, key);
    try {
      const { size } = await fs.stat(target);
      return { size, read: (range) => createReadStream(target, range) };
    } catch {
      return null;
    }
  },
  async delete(key) {
    const target = path.join(localRoot, key);
    await fs.rm(target, { force: true });
    // Each upload gets its own directory, so it goes with the file. Fails harmlessly if anything else is in it.
    await fs.rmdir(path.dirname(target)).catch(() => {});
  },
  urlFor(key) {
    return `/api/files/${encodeURIComponent(key)}`;
  },
};

const s3Provider: StorageProvider = {
  name: "s3",
  async put() {
    throw new AppError("Object storage is not configured for this environment.", "storage_unavailable", 503);
  },
  async putStream() {
    throw new AppError("Object storage is not configured for this environment.", "storage_unavailable", 503);
  },
  async get() {
    return null;
  },
  async open() {
    return null;
  },
  async delete() {},
  urlFor(key) {
    const base = env.FILE_STORAGE_PUBLIC_URL?.replace(/\/$/, "");
    return base ? `${base}/${key}` : `/api/files/${encodeURIComponent(key)}`;
  },
};

export function storage(): StorageProvider {
  return env.FILE_STORAGE_PROVIDER === "s3" ? s3Provider : localProvider;
}

export function safeFileName(input: string): string {
  const base = path.basename(input).replace(/[^a-zA-Z0-9._-]/g, "_");
  return base.slice(-120) || "upload";
}

export async function storeFile(input: {
  file: File;
  purpose: FilePurpose;
  ownerId: string | null;
}): Promise<{ id: string; fileName: string; byteSize: number }> {
  const rules = FILE_RULES[input.purpose];
  const size = input.file.size;
  if (size <= 0) throw new AppError("That file is empty. Choose a different file.", "empty_file");
  if (size > rules.maxBytes) {
    throw new AppError(
      `That file is larger than the ${Math.round(rules.maxBytes / (1024 * 1024))} MB limit for this upload.`,
      "file_too_large",
    );
  }
  const type = input.file.type || "application/octet-stream";
  if (!(rules.types as readonly string[]).includes(type)) {
    throw new AppError("That file type is not accepted here. Check the accepted formats and try again.", "file_type_rejected");
  }

  const buffer = Buffer.from(await input.file.arrayBuffer());
  const fileName = safeFileName(input.file.name);
  const key = `${input.purpose}/${crypto.randomUUID()}/${fileName}`;
  const provider = storage();
  await provider.put({ key, body: buffer, contentType: type });

  const [row] = await db
    .insert(storedFiles)
    .values({
      ownerId: input.ownerId,
      provider: provider.name,
      storageKey: key,
      fileName,
      contentType: type,
      byteSize: size,
      purpose: input.purpose,
    })
    .returning({ id: storedFiles.id });

  log.info("file_stored", { purpose: input.purpose, provider: provider.name, byteSize: size });
  return { id: row.id, fileName, byteSize: size };
}

/**
 * What must stay free on the disk after a video is accepted. Videos are by far
 * the largest thing stored and share a volume with resumes, so they are refused
 * while there is still room for everything else rather than filling it.
 */
export const VIDEO_DISK_RESERVE_BYTES = 1024 * 1024 * 1024;

/** Pure so the arithmetic can be tested without filling a disk. */
export function videoFitsOnDisk(freeBytes: number, incomingBytes: number) {
  return freeBytes - incomingBytes >= VIDEO_DISK_RESERVE_BYTES;
}

/**
 * What uploads in progress have spoken for. The disk does not show them yet, so
 * without this a burst of uploads could each see room and together pass the
 * reserve. One process serves the volume, so a plain counter is the whole truth.
 */
let reservedVideoBytes = 0;

async function assertRoomForVideo(incomingBytes: number) {
  if (storage().name !== "local") return;
  await fs.mkdir(localRoot, { recursive: true });
  const stats = await fs.statfs(localRoot);
  const free = stats.bavail * stats.bsize;
  if (!videoFitsOnDisk(free - reservedVideoBytes, incomingBytes)) {
    log.error("video_storage_low", { freeBytes: free, reservedBytes: reservedVideoBytes, incomingBytes });
    throw new AppError(
      "ResearchBridge cannot take video uploads right now. Share your video as a Loom or YouTube link instead.",
      "video_storage_full",
      507,
    );
  }
}

/** Counts and checks bytes as they pass, stopping an upload as soon as it breaks a rule. */
function videoGate() {
  let seen = 0;
  let type: UploadedVideoType | null = null;
  let head = Buffer.alloc(0);

  const transform = new Transform({
    transform(chunk: Buffer, _encoding, done) {
      seen += chunk.length;
      if (seen > VIDEO_UPLOAD_MAX_BYTES) {
        done(new AppError(VIDEO_TOO_LARGE_MESSAGE, "file_too_large", 413));
        return;
      }
      if (!type) {
        head = Buffer.concat([head, chunk]);
        if (head.length >= VIDEO_SNIFF_BYTES) {
          type = sniffVideoType(head);
          if (!type) {
            done(new AppError(VIDEO_TYPE_MESSAGE, "file_type_rejected", 415));
            return;
          }
        }
      }
      done(null, chunk);
    },
    flush(done) {
      if (seen === 0) done(new AppError("That file is empty. Choose a different file.", "empty_file", 400));
      // A body too short for the check above never reached it.
      else if (!type) done(new AppError(VIDEO_TYPE_MESSAGE, "file_type_rejected", 415));
      else done();
    },
  });

  return { transform, bytes: () => seen, type: () => type };
}

/**
 * Stores a video sent with an application. Unlike `storeFile`, this reads the
 * upload as a stream, because a file of this size has no business in memory, and
 * records the type read from its bytes rather than the one it arrived claiming.
 */
export async function storeVideoStream(input: {
  stream: ReadableStream<Uint8Array>;
  /** Only what the client declared, so it decides nothing except an early refusal. */
  declaredBytes: number | null;
  fileName: string;
  ownerId: string;
}): Promise<{ id: string; fileName: string; byteSize: number; contentType: UploadedVideoType }> {
  if (input.declaredBytes !== null && input.declaredBytes > VIDEO_UPLOAD_MAX_BYTES) {
    throw new AppError(VIDEO_TOO_LARGE_MESSAGE, "file_too_large", 413);
  }
  const incoming = input.declaredBytes ?? VIDEO_UPLOAD_MAX_BYTES;
  await assertRoomForVideo(incoming);
  reservedVideoBytes += incoming;

  const fileName = safeFileName(input.fileName);
  const key = `${APPLICATION_VIDEO_PURPOSE}/${crypto.randomUUID()}/${fileName}`;
  const provider = storage();
  const gate = videoGate();

  try {
    await provider.putStream({ key, stages: [Readable.fromWeb(input.stream as never), gate.transform] });

    const contentType = gate.type();
    if (!contentType) throw new AppError(VIDEO_TYPE_MESSAGE, "file_type_rejected", 415);

    const [row] = await db
      .insert(storedFiles)
      .values({
        ownerId: input.ownerId,
        provider: provider.name,
        storageKey: key,
        fileName,
        contentType,
        byteSize: gate.bytes(),
        purpose: APPLICATION_VIDEO_PURPOSE,
      })
      .returning({ id: storedFiles.id });

    log.info("file_stored", { purpose: APPLICATION_VIDEO_PURPOSE, provider: provider.name, byteSize: gate.bytes() });
    return { id: row.id, fileName, byteSize: gate.bytes(), contentType };
  } catch (caught) {
    // Nothing points at a partial upload, so it would otherwise sit on the volume forever.
    await provider.delete(key).catch(() => {});
    throw caught;
  } finally {
    reservedVideoBytes -= incoming;
  }
}

/**
 * Removes a video that no application points at any more. Only ever touches this
 * purpose, so a stray id cannot take a resume with it. A failure here leaves a
 * stray file on disk, which is not worth failing the student's request over.
 */
export async function removeApplicationVideo(fileId: string | null | undefined) {
  if (!fileId) return;
  try {
    const [row] = await db.select().from(storedFiles).where(eq(storedFiles.id, fileId)).limit(1);
    if (!row || row.purpose !== APPLICATION_VIDEO_PURPOSE) return;
    await db.delete(storedFiles).where(eq(storedFiles.id, fileId));
    await storage().delete(row.storageKey);
  } catch (caught) {
    log.error("video_removal_failed", { fileId, error: caught });
  }
}
