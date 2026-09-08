import { beforeEach, describe, expect, it } from "vitest";
import { db, directMessages, follows } from "@/db";
import { canMessage, listConversations, loadThread, markThreadRead, unreadMessageCount } from "@/lib/queries/messages";
import { createApplication, createOpportunity, createResearcher, createStudent } from "../fixtures";

async function follow(followerId: string, followingId: string) {
  await db.insert(follows).values({ followerId, followingId }).onConflictDoNothing();
}

let clock = Date.now();

/** Explicit timestamps: the system clock is too coarse to order three inserts. */
async function send(senderId: string, recipientId: string, body: string) {
  clock += 1000;
  await db.insert(directMessages).values({ senderId, recipientId, body, createdAt: new Date(clock) });
}

describe("who may open a conversation", () => {
  it("lets a researcher write to any student without an application in between", async () => {
    const researcher = await createResearcher();
    const student = await createStudent();

    const result = await canMessage({ id: researcher.id, role: "researcher" }, student.id);
    expect(result.allowed).toBe(true);
  });

  it("stops a student cold-messaging a researcher who has not followed back", async () => {
    const researcher = await createResearcher();
    const student = await createStudent();
    await follow(student.id, researcher.id);

    const result = await canMessage({ id: student.id, role: "student" }, researcher.id);
    expect(result.allowed).toBe(false);
    if (result.allowed) return;
    expect(result.reason).toContain("follow you back");
  });

  it("opens the inbox once the follow is mutual", async () => {
    const researcher = await createResearcher();
    const student = await createStudent();
    await follow(student.id, researcher.id);
    await follow(researcher.id, student.id);

    expect((await canMessage({ id: student.id, role: "student" }, researcher.id)).allowed).toBe(true);
  });

  it("opens the inbox once the researcher has engaged with an application", async () => {
    const researcher = await createResearcher();
    const student = await createStudent();
    const opportunity = await createOpportunity(researcher.id);
    await createApplication(opportunity.id, student.id, { status: "shortlisted", submittedAt: new Date() });

    expect((await canMessage({ id: student.id, role: "student" }, researcher.id)).allowed).toBe(true);
  });

  it("keeps the inbox shut while an application is only submitted", async () => {
    const researcher = await createResearcher();
    const student = await createStudent();
    const opportunity = await createOpportunity(researcher.id);
    await createApplication(opportunity.id, student.id, { status: "submitted", submittedAt: new Date() });

    expect((await canMessage({ id: student.id, role: "student" }, researcher.id)).allowed).toBe(false);
  });

  it("keeps a conversation open once it exists, whatever happens to the follow", async () => {
    const researcher = await createResearcher();
    const student = await createStudent();
    await send(researcher.id, student.id, "Your profile looked relevant to a project I am starting.");

    expect((await canMessage({ id: student.id, role: "student" }, researcher.id)).allowed).toBe(true);
  });

  it("refuses one student writing to another, however they are connected", async () => {
    const one = await createStudent();
    const two = await createStudent();
    await follow(one.id, two.id);
    await follow(two.id, one.id);

    const result = await canMessage({ id: one.id, role: "student" }, two.id);
    expect(result.allowed).toBe(false);
    if (result.allowed) return;
    expect(result.reason).toContain("students with researchers");
  });

  it("refuses one researcher writing to another", async () => {
    const one = await createResearcher();
    const two = await createResearcher();

    expect((await canMessage({ id: one.id, role: "researcher" }, two.id)).allowed).toBe(false);
  });

  it("refuses a conversation with yourself", async () => {
    const student = await createStudent();
    const result = await canMessage({ id: student.id, role: "student" }, student.id);
    expect(result.allowed).toBe(false);
  });
});

describe("threads and unread counts", () => {
  let researcherId = "";
  let studentId = "";

  beforeEach(async () => {
    const researcher = await createResearcher();
    const student = await createStudent();
    researcherId = researcher.id;
    studentId = student.id;
  });

  it("returns a thread in the order it was written, from either side", async () => {
    await send(researcherId, studentId, "First");
    await send(studentId, researcherId, "Second");
    await send(researcherId, studentId, "Third");

    const fromResearcher = await loadThread(researcherId, studentId);
    const fromStudent = await loadThread(studentId, researcherId);

    expect(fromResearcher.map((message) => message.body)).toEqual(["First", "Second", "Third"]);
    expect(fromStudent.map((message) => message.body)).toEqual(["First", "Second", "Third"]);
  });

  it("counts only messages the viewer has received and not opened", async () => {
    await send(researcherId, studentId, "One");
    await send(researcherId, studentId, "Two");
    await send(studentId, researcherId, "Reply");

    expect(await unreadMessageCount(studentId)).toBe(2);
    expect(await unreadMessageCount(researcherId)).toBe(1);

    await markThreadRead(studentId, researcherId);
    expect(await unreadMessageCount(studentId)).toBe(0);
    expect(await unreadMessageCount(researcherId)).toBe(1);
  });

  it("leaves a same-role conversation out of the inbox", async () => {
    const peer = await createStudent();
    await send(peer.id, studentId, "A message from before the two sides were separated.");
    await send(researcherId, studentId, "A message from a researcher.");

    const conversations = await listConversations({ id: studentId, role: "student" });
    expect(conversations.map((entry) => entry.person.id)).toEqual([researcherId]);
  });

  it("gives one row per counterpart with the newest message on it", async () => {
    const other = await createStudent();
    await send(researcherId, studentId, "To the first student");
    await send(researcherId, other.id, "To the second student");
    await send(studentId, researcherId, "The latest word");

    const conversations = await listConversations({ id: researcherId, role: "researcher" });
    expect(conversations).toHaveLength(2);
    expect(conversations[0].person.id).toBe(studentId);
    expect(conversations[0].lastMessage).toBe("The latest word");
    expect(conversations[0].lastFromMe).toBe(false);
    expect(conversations[0].unread).toBe(1);

    const second = conversations.find((entry) => entry.person.id === other.id);
    expect(second?.lastFromMe).toBe(true);
    expect(second?.unread).toBe(0);
  });
});
