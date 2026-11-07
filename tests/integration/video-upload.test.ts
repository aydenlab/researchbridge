import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { applicationAnswers, applications, db, storedFiles } from "@/db";
import type { SessionUser } from "@/lib/auth/session";
import { listApplicantsForOpportunity } from "@/lib/queries/applications";
import { VIDEO_DISK_RESERVE_BYTES, storage, videoFitsOnDisk } from "@/lib/storage";
import { VIDEO_UPLOAD_MAX_BYTES } from "@/lib/video-files";
import { addQuestion, createApplication, createOpportunity, createResearcher, createStudent } from "../fixtures";

/**
 * The upload and playback routes, called the way a browser calls them, against
 * real storage on disk. Only who is signed in and post-response work is mocked.
 */
let signedIn: SessionUser | null = null;

vi.mock("@/lib/auth/session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/session")>()),
  getSessionUser: async () => signedIn,
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: () => {},
}));
vi.mock("@/lib/auth/permissions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/permissions")>()),
  requireStudent: async () => {
    if (!signedIn) throw new Error("nobody signed in");
    return signedIn;
  },
}));

const upload = await import("@/app/api/applications/[id]/video/route");
const files = await import("@/app/api/files/by-id/[fileId]/route");
const { saveDraftAction, submitApplicationAction, deleteDraftAction } = await import("@/app/(app)/applications/actions");

const MP4_HEAD = new Uint8Array([0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0, 0, 2, 0]);

function mp4(bytes = 4096) {
  const body = new Uint8Array(bytes);
  body.set(MP4_HEAD);
  for (let index = MP4_HEAD.length; index < bytes; index += 1) body[index] = index % 251;
  return body;
}

function session(user: { id: string; email: string; institutionId: string | null }, role: "student" | "researcher" | "admin") {
  return { id: user.id, email: user.email, role, accountStatus: "active", institutionId: user.institutionId } as unknown as SessionUser;
}

function put(applicationId: string, body: Uint8Array | null, headers: Record<string, string> = {}) {
  return upload.PUT(
    new Request(`http://test/api/applications/${applicationId}/video`, {
      method: "PUT",
      body: body ? Buffer.from(body) : undefined,
      headers: { "X-File-Name": "my%20intro.mp4", ...(body ? { "Content-Length": String(body.length) } : {}), ...headers },
      ...(body ? { duplex: "half" } : {}),
    } as RequestInit),
    { params: Promise.resolve({ id: applicationId }) },
  );
}

function get(fileId: string, range?: string) {
  return files.GET(new Request(`http://test/api/files/by-id/${fileId}`, { headers: range ? { Range: range } : {} }), {
    params: Promise.resolve({ fileId }),
  });
}

async function setup(videoRequired = true) {
  const researcher = await createResearcher();
  const student = await createStudent();
  const opportunity = await createOpportunity(researcher.id, { videoResponseEnabled: true, videoMaxSeconds: 60 });
  const question = await addQuestion(opportunity.id, {
    type: "video_response",
    prompt: "Tell us why this project.",
    required: videoRequired,
    config: {},
  });
  const application = await createApplication(opportunity.id, student.id);
  return { researcher, student, opportunity, question, application };
}

async function answerFor(applicationId: string) {
  const [row] = await db.select().from(applicationAnswers).where(eq(applicationAnswers.applicationId, applicationId));
  return row;
}

const created: string[] = [];

async function uploaded(applicationId: string, body = mp4()) {
  const response = await put(applicationId, body);
  expect(response.status).toBe(200);
  const { file } = await response.json();
  created.push(file.id);
  return file as { id: string; fileName: string; byteSize: number; contentType: string };
}

async function storedOnDisk(fileId: string) {
  const [row] = await db.select().from(storedFiles).where(eq(storedFiles.id, fileId));
  return row ? (await storage().open(row.storageKey)) !== null : false;
}

beforeEach(() => {
  signedIn = null;
});

afterEach(async () => {
  for (const id of created.splice(0)) {
    const [row] = await db.select().from(storedFiles).where(eq(storedFiles.id, id));
    if (row) await storage().delete(row.storageKey);
  }
});

describe("uploading a video to a draft", () => {
  it("stores the file against the application, under the type its bytes show", async () => {
    const { student, application } = await setup();
    signedIn = session(student, "student");

    const file = await uploaded(application.id);

    expect(file.byteSize).toBe(4096);
    expect(file.contentType).toBe("video/mp4");
    expect(file.fileName).toBe("my_intro.mp4");
    const answer = await answerFor(application.id);
    expect(answer.fileId).toBe(file.id);
    expect((answer.structuredAnswer as { provider: string }).provider).toBe("file");
    expect(await storedOnDisk(file.id)).toBe(true);
  });

  it("ignores the content type a client claims", async () => {
    const { student, application } = await setup();
    signedIn = session(student, "student");

    const refused = await put(application.id, new TextEncoder().encode("<html><script>alert(1)</script></html>"), {
      "Content-Type": "video/mp4",
    });

    expect(refused.status).toBe(415);
    expect((await refused.json()).error).toMatch(/not a video/i);
    expect(await answerFor(application.id)).toBeUndefined();
  });

  it("refuses a file that declares more than the limit before reading it", async () => {
    const { student, application } = await setup();
    signedIn = session(student, "student");

    const response = await upload.PUT(
      new Request(`http://test/api/applications/${application.id}/video`, {
        method: "PUT",
        body: Buffer.from(mp4(32)),
        headers: { "Content-Length": String(VIDEO_UPLOAD_MAX_BYTES + 1) },
        duplex: "half",
      } as RequestInit),
      { params: Promise.resolve({ id: application.id }) },
    );

    expect(response.status).toBe(413);
    expect((await response.json()).error).toMatch(/200 MB/);
  });

  it("stops a body that turns out larger than it declared, and leaves nothing behind", async () => {
    const { student, application } = await setup();
    signedIn = session(student, "student");
    const before = await db.select().from(storedFiles);

    let sent = 0;
    const chunk = mp4(8 * 1024 * 1024);
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (sent > VIDEO_UPLOAD_MAX_BYTES + chunk.length) return controller.close();
        sent += chunk.length;
        controller.enqueue(chunk);
      },
    });
    const response = await upload.PUT(
      new Request(`http://test/api/applications/${application.id}/video`, { method: "PUT", body: stream, duplex: "half" } as RequestInit),
      { params: Promise.resolve({ id: application.id }) },
    );

    expect(response.status).toBe(413);
    expect((await db.select().from(storedFiles)).length).toBe(before.length);
    expect(await answerFor(application.id)).toBeUndefined();
  });

  it("refuses an empty file", async () => {
    const { student, application } = await setup();
    signedIn = session(student, "student");
    const response = await put(application.id, new Uint8Array(0));
    expect([400, 415]).toContain(response.status);
  });

  it("deletes the old video when a new one replaces it", async () => {
    const { student, application } = await setup();
    signedIn = session(student, "student");

    const first = await uploaded(application.id);
    const second = await uploaded(application.id, mp4(8192));

    expect((await answerFor(application.id)).fileId).toBe(second.id);
    expect(await db.select().from(storedFiles).where(eq(storedFiles.id, first.id))).toEqual([]);
  });

  it("lets the student remove it", async () => {
    const { student, application } = await setup();
    signedIn = session(student, "student");
    const file = await uploaded(application.id);

    const response = await upload.DELETE(new Request("http://test", { method: "DELETE" }), {
      params: Promise.resolve({ id: application.id }),
    });

    expect(response.status).toBe(200);
    expect((await answerFor(application.id)).fileId).toBeNull();
    expect(await db.select().from(storedFiles).where(eq(storedFiles.id, file.id))).toEqual([]);
  });

  it("is only open to the signed-in owner of an unsent draft", async () => {
    const { student, application, researcher } = await setup();

    expect((await put(application.id, mp4())).status).toBe(401);

    signedIn = session(await createStudent(), "student");
    expect((await put(application.id, mp4())).status).toBe(404);

    signedIn = session(researcher, "researcher");
    expect((await put(application.id, mp4())).status).toBe(404);

    signedIn = session(student, "student");
    await db.update(applications).set({ status: "submitted" }).where(eq(applications.id, application.id));
    expect((await put(application.id, mp4())).status).toBe(409);
  });

  it("refuses when the position is not asking for a video", async () => {
    const researcher = await createResearcher();
    const student = await createStudent();
    const opportunity = await createOpportunity(researcher.id, { videoResponseEnabled: false });
    await addQuestion(opportunity.id, { type: "video_response", prompt: "Old request.", required: true, config: {} });
    const application = await createApplication(opportunity.id, student.id);
    signedIn = session(student, "student");

    expect((await put(application.id, mp4())).status).toBe(409);
  });
});

describe("an upload finishing after the world moved on", () => {
  function slowBody(body: Uint8Array, beforeEnd: () => Promise<void>) {
    return new Request("http://test", {
      method: "PUT",
      duplex: "half",
      body: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(body);
        },
        async pull(controller) {
          await beforeEnd();
          controller.close();
        },
      }),
    } as RequestInit);
  }

  it("does not change an application submitted while the video was still uploading", async () => {
    const { student, application } = await setup();
    signedIn = session(student, "student");
    const first = await uploaded(application.id);

    const response = await upload.PUT(
      slowBody(mp4(), async () => {
        await db.update(applications).set({ status: "submitted" }).where(eq(applications.id, application.id));
      }),
      { params: Promise.resolve({ id: application.id }) },
    );

    expect(response.status).toBe(409);
    expect((await answerFor(application.id)).fileId).toBe(first.id);
    expect(await storedOnDisk(first.id)).toBe(true);
    expect((await db.select().from(storedFiles).where(eq(storedFiles.ownerId, student.id))).length).toBe(1);
  });

  it("leaves no orphan when two uploads race on one draft", async () => {
    const { student, application } = await setup();
    signedIn = session(student, "student");

    const responses = await Promise.all([put(application.id, mp4()), put(application.id, mp4(8192))]);
    expect(responses.map((response) => response.status)).toEqual([200, 200]);

    const rows = await db.select().from(storedFiles).where(eq(storedFiles.ownerId, student.id));
    expect(rows).toHaveLength(1);
    expect((await answerFor(application.id)).fileId).toBe(rows[0].id);
    created.push(rows[0].id);
  });
});

describe("how the draft form treats an uploaded video", () => {
  function draftForm(applicationId: string, questionId: string, values: Record<string, string>) {
    const data = new FormData();
    data.set("applicationId", applicationId);
    for (const [key, value] of Object.entries(values)) data.set(key.replace("VIDEO", `q_${questionId}`), value);
    return data;
  }

  it("keeps the file when a draft is saved with the upload option selected", async () => {
    const { student, application, question } = await setup();
    signedIn = session(student, "student");
    const file = await uploaded(application.id);

    await saveDraftAction(null, draftForm(application.id, question.id, { VIDEO_provider: "file" }));

    expect((await answerFor(application.id)).fileId).toBe(file.id);
  });

  it("keeps the file when another option is tried without pasting anything", async () => {
    const { student, application, question } = await setup();
    signedIn = session(student, "student");
    const file = await uploaded(application.id);

    await saveDraftAction(null, draftForm(application.id, question.id, { VIDEO_provider: "loom", VIDEO: "" }));

    expect((await answerFor(application.id)).fileId).toBe(file.id);
  });

  it("keeps the file when a half-typed link is autosaved", async () => {
    const { student, application, question } = await setup();
    signedIn = session(student, "student");
    const file = await uploaded(application.id);

    await saveDraftAction(null, draftForm(application.id, question.id, { VIDEO_provider: "loom", VIDEO: "h" }));
    await saveDraftAction(null, draftForm(application.id, question.id, { VIDEO_provider: "loom", VIDEO: "https://vimeo.com/123" }));

    expect((await answerFor(application.id)).fileId).toBe(file.id);
    expect(await storedOnDisk(file.id)).toBe(true);
  });

  it("keeps a saved link when the upload option is only selected, until a file is actually uploaded", async () => {
    const { student, application, question } = await setup();
    signedIn = session(student, "student");
    await saveDraftAction(null, draftForm(application.id, question.id, { VIDEO_provider: "youtube", VIDEO: "https://youtu.be/dQw4w9WgXcQ" }));

    await saveDraftAction(null, draftForm(application.id, question.id, { VIDEO_provider: "file" }));
    expect((await answerFor(application.id)).structuredAnswer).toMatchObject({ videoId: "dQw4w9WgXcQ" });

    const file = await uploaded(application.id);
    const answer = await answerFor(application.id);
    expect(answer.fileId).toBe(file.id);
    expect(answer.structuredAnswer).toMatchObject({ provider: "file", videoId: null });
  });

  it("replaces the file, and deletes it, when a link is actually given", async () => {
    const { student, application, question } = await setup();
    signedIn = session(student, "student");
    const file = await uploaded(application.id);

    await saveDraftAction(
      null,
      draftForm(application.id, question.id, { VIDEO_provider: "youtube", VIDEO: "https://youtu.be/dQw4w9WgXcQ" }),
    );

    const answer = await answerFor(application.id);
    expect(answer.fileId).toBeNull();
    expect((answer.structuredAnswer as { videoId: string }).videoId).toBe("dQw4w9WgXcQ");
    expect(await db.select().from(storedFiles).where(eq(storedFiles.id, file.id))).toEqual([]);
  });

  it("satisfies a required video when submitting, and refuses when there is neither file nor link", async () => {
    const { student, application, question } = await setup();
    signedIn = session(student, "student");

    const refused = await submitApplicationAction(null, draftForm(application.id, question.id, { VIDEO_provider: "file" }));
    expect(refused?.ok).toBe(false);
    expect(refused && !refused.ok ? refused.error : "").toMatch(/your video/);

    await uploaded(application.id);
    const stillBlocked = await submitApplicationAction(null, draftForm(application.id, question.id, { VIDEO_provider: "file" }));
    // Past the video check: what stops it now is only the resume this fixture lacks.
    expect(stillBlocked && !stillBlocked.ok ? stillBlocked.error : "").toMatch(/resume/i);
  });

  it("removes the video from disk when the draft is discarded", async () => {
    const { student, application } = await setup();
    signedIn = session(student, "student");
    const file = await uploaded(application.id);

    const data = new FormData();
    data.set("applicationId", application.id);
    await expect(deleteDraftAction(null, data)).rejects.toThrow(/REDIRECT/);

    expect(await db.select().from(storedFiles).where(eq(storedFiles.id, file.id))).toEqual([]);
  });
});

describe("watching an uploaded video", () => {
  async function submittedWithVideo() {
    const graph = await setup();
    signedIn = session(graph.student, "student");
    const file = await uploaded(graph.application.id);
    await db
      .update(applications)
      .set({ status: "submitted", submittedAt: new Date() })
      .where(eq(applications.id, graph.application.id));
    return { ...graph, file };
  }

  it("flags the applicant as having sent a video", async () => {
    const { opportunity } = await submittedWithVideo();
    const [row] = await listApplicantsForOpportunity(opportunity.id);
    expect(row.hasVideo).toBe(true);
  });

  it("serves the whole file to the researcher who received it, as a video", async () => {
    const { researcher, file } = await submittedWithVideo();
    signedIn = session(researcher, "researcher");

    const response = await get(file.id);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("video/mp4");
    expect(response.headers.get("accept-ranges")).toBe("bytes");
    expect(response.headers.get("content-length")).toBe("4096");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(mp4());
  });

  it("answers a range request with exactly those bytes, as a player needs to seek", async () => {
    const { researcher, file } = await submittedWithVideo();
    signedIn = session(researcher, "researcher");

    const response = await get(file.id, "bytes=100-199");

    expect(response.status).toBe(206);
    expect(response.headers.get("content-range")).toBe("bytes 100-199/4096");
    expect(response.headers.get("content-length")).toBe("100");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(mp4().subarray(100, 200));
  });

  it("answers a range past the end with a 416 naming the real size", async () => {
    const { researcher, file } = await submittedWithVideo();
    signedIn = session(researcher, "researcher");

    const response = await get(file.id, "bytes=5000-");

    expect(response.status).toBe(416);
    expect(response.headers.get("content-range")).toBe("bytes */4096");
  });

  it("lets the student and an admin watch it, and nobody else", async () => {
    const { student, file } = await submittedWithVideo();

    signedIn = session(student, "student");
    expect((await get(file.id)).status).toBe(200);

    signedIn = session(await createResearcher(), "admin");
    expect((await get(file.id)).status).toBe(200);

    signedIn = session(await createStudent(), "student");
    expect((await get(file.id)).status).toBe(403);
    expect((await get(file.id, "bytes=0-10")).status).toBe(403);

    signedIn = session(await createResearcher(), "researcher");
    expect((await get(file.id)).status).toBe(403);

    signedIn = null;
    expect((await get(file.id)).status).toBe(401);
  });

  it("keeps a video on an unsent draft from the researcher", async () => {
    const { researcher, student, application } = await setup();
    signedIn = session(student, "student");
    const file = await uploaded(application.id);

    signedIn = session(researcher, "researcher");
    expect((await get(file.id)).status).toBe(403);
  });

  it("says a file is gone rather than failing when the disk no longer has it", async () => {
    const { researcher, file } = await submittedWithVideo();
    const [row] = await db.select().from(storedFiles).where(eq(storedFiles.id, file.id));
    await storage().delete(row.storageKey);
    signedIn = session(researcher, "researcher");

    expect((await get(file.id)).status).toBe(404);
  });
});

describe("protecting the shared volume", () => {
  it("refuses a video that would eat into the reserve kept for everything else", () => {
    const video = 100 * 1024 * 1024;
    expect(videoFitsOnDisk(VIDEO_DISK_RESERVE_BYTES + video, video)).toBe(true);
    expect(videoFitsOnDisk(VIDEO_DISK_RESERVE_BYTES + video - 1, video)).toBe(false);
    expect(videoFitsOnDisk(0, video)).toBe(false);
  });
});

