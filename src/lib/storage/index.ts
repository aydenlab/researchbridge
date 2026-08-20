import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { db, storedFiles } from "@/db";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { log } from "@/lib/log";
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

const localRoot = path.join(process.cwd(), ".storage");

const localProvider: StorageProvider = {
  name: "local",
  async put({ key, body }) {
    const target = path.join(localRoot, key);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, body);
  },
  async get(key) {
    try {
      return await fs.readFile(path.join(localRoot, key));
    } catch {
      return null;
    }
  },
  async delete(key) {
    await fs.rm(path.join(localRoot, key), { force: true });
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
  async get() {
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
