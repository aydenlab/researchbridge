import type { Readable, Transform } from "node:stream";

export type StoredObject = {
  key: string;
  fileName: string;
  contentType: string;
  byteSize: number;
};

export interface StorageProvider {
  readonly name: string;
  put(input: { key: string; body: Buffer; contentType: string }): Promise<void>;
  /** Writes a body as it arrives, so a large upload never sits in memory. `stages` run in order, source first. */
  putStream(input: { key: string; stages: [Readable, ...Transform[]] }): Promise<void>;
  get(key: string): Promise<Buffer | null>;
  /** The object's real size and a reader for all of it or one byte range. Null when it is not stored. */
  open(key: string): Promise<{ size: number; read(range?: { start: number; end: number }): Readable } | null>;
  delete(key: string): Promise<void>;
  urlFor(key: string): string;
}
