import type { Readable } from "node:stream";

export type ByteRange = { start: number; end: number };

/**
 * Reads a `Range` header against a file of `size` bytes. A video player depends
 * on this: browsers fetch the piece they need to seek, and Safari refuses to
 * play a video at all from a server that cannot answer one.
 *
 * Null means send the whole file, which is also the right answer to a form this
 * does not handle (several ranges at once, or some other unit). "unsatisfiable"
 * means a range that starts past the end, which the caller answers with a 416.
 */
export function parseByteRange(header: string | null, size: number): ByteRange | "unsatisfiable" | null {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;
  const [, rawStart, rawEnd] = match;
  if (!rawStart && !rawEnd) return null;

  if (!rawStart) {
    // "bytes=-500" is the last 500 bytes.
    const length = Number(rawEnd);
    if (length === 0 || size === 0) return "unsatisfiable";
    return { start: Math.max(size - length, 0), end: size - 1 };
  }

  const start = Number(rawStart);
  const end = rawEnd ? Math.min(Number(rawEnd), size - 1) : size - 1;
  if (start >= size || end < start) return "unsatisfiable";
  return { start, end };
}

/**
 * A response body that opens its source only when the first byte is read.
 *
 * Opening it any earlier leaks a file descriptor: the framework never reads or
 * cancels the body of a HEAD request, or of a client that hung up before the
 * handler returned, so nothing would ever close the file. A video player cancels
 * requests constantly while someone scrubs, so this would add up to a process
 * that can no longer open anything.
 */
export function lazyWebStream(open: () => Readable): ReadableStream<Uint8Array> {
  let source: AsyncIterator<Buffer> | null = null;
  return new ReadableStream<Uint8Array>(
    {
      async pull(controller) {
        source ??= open()[Symbol.asyncIterator]();
        const { value, done } = await source.next();
        if (done) controller.close();
        else controller.enqueue(new Uint8Array(value));
      },
      async cancel() {
        // Ending the iterator early is what destroys the stream and closes the file.
        await source?.return?.();
      },
    },
    { highWaterMark: 0 },
  );
}
