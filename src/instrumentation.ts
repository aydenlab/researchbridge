/**
 * Runs once per server process, before any request is served.
 *
 * The weekly digest is scheduled from here rather than from a route, so that
 * nothing about it can influence a health check or slow down a request. Next
 * calls this for the edge runtime too, where a database driver cannot load, so
 * the import is guarded and deliberately dynamic.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  try {
    const { startDigestScheduler } = await import("@/lib/notifications/schedule");
    startDigestScheduler();
  } catch (error) {
    // Startup must never fail because a background schedule could not be set
    // up. The manual endpoint still works if this goes wrong.
    console.error(
      JSON.stringify({
        level: "error",
        event: "instrumentation_digest_scheduler_failed",
        ts: new Date().toISOString(),
        error: String(error),
      }),
    );
  }
}
