import { describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { db, follows } from "@/db";
import {
  followCounts,
  isFollowing,
  listFollowerIds,
  listFollowingIds,
  loadPeople,
  loadVisiblePeople,
  sharedConnectionIds,
  suggestedPeopleIds,
} from "@/lib/queries/social";
import { createResearcher, createStudent } from "../fixtures";

async function follow(followerId: string, followingId: string) {
  await db.insert(follows).values({ followerId, followingId }).onConflictDoNothing();
}

describe("following", () => {
  it("records a follow in one direction only", async () => {
    const a = await createStudent();
    const b = await createResearcher();

    await follow(a.id, b.id);

    expect(await isFollowing(a.id, b.id)).toBe(true);
    expect(await isFollowing(b.id, a.id)).toBe(false);
  });

  it("counts followers and following separately", async () => {
    const subject = await createResearcher();
    const first = await createStudent();
    const second = await createStudent();

    await follow(first.id, subject.id);
    await follow(second.id, subject.id);
    await follow(subject.id, first.id);

    const counts = await followCounts(subject.id);
    expect(counts.followers).toBe(2);
    expect(counts.following).toBe(1);

    expect(await listFollowerIds(subject.id)).toHaveLength(2);
    expect(await listFollowingIds(subject.id)).toEqual([first.id]);
  });

  it("is idempotent, so a repeated follow does not duplicate the row", async () => {
    const a = await createStudent();
    const b = await createResearcher();

    await follow(a.id, b.id);
    await follow(a.id, b.id);

    const rows = await db
      .select()
      .from(follows)
      .where(and(eq(follows.followerId, a.id), eq(follows.followingId, b.id)));
    expect(rows).toHaveLength(1);
  });

  it("refuses a self follow at the database level", async () => {
    const a = await createStudent();
    await expect(db.insert(follows).values({ followerId: a.id, followingId: a.id })).rejects.toThrow();
  });

  it("surfaces only shared connections the viewer already follows", async () => {
    const viewer = await createStudent();
    const subject = await createResearcher();
    const shared = await createResearcher();
    const stranger = await createResearcher();

    // The viewer follows `shared`, and `shared` follows the subject.
    await follow(viewer.id, shared.id);
    await follow(shared.id, subject.id);
    // A stranger also follows the subject, but the viewer does not know them.
    await follow(stranger.id, subject.id);

    const ids = await sharedConnectionIds(viewer, subject.id);
    expect(ids).toEqual([shared.id]);
    expect(ids).not.toContain(stranger.id);
  });

  it("leaves same-role accounts out of shared connections", async () => {
    const viewer = await createStudent();
    const subject = await createResearcher();
    const shared = await createResearcher();
    // A student-to-student follow from before the two sides were separated.
    const peer = await createStudent();

    await follow(viewer.id, shared.id);
    await follow(shared.id, subject.id);
    await follow(viewer.id, peer.id);
    await follow(peer.id, subject.id);

    const ids = await sharedConnectionIds(viewer, subject.id);
    expect(ids).toEqual([shared.id]);
    expect(ids).not.toContain(peer.id);
  });

  it("returns nothing for shared connections with yourself", async () => {
    const viewer = await createStudent();
    expect(await sharedConnectionIds(viewer, viewer.id)).toEqual([]);
  });

  it("never suggests yourself or somebody you already follow", async () => {
    const viewer = await createStudent();
    const already = await createResearcher();
    await follow(viewer.id, already.id);

    const suggestions = await suggestedPeopleIds(viewer, 50);
    expect(suggestions).not.toContain(viewer.id);
    expect(suggestions).not.toContain(already.id);
  });

  it("suggests only the other side of the platform", async () => {
    const viewer = await createStudent();
    const peer = await createStudent();
    const researcher = await createResearcher();

    const suggestions = await suggestedPeopleIds(viewer, 50);
    expect(suggestions).toContain(researcher.id);
    expect(suggestions).not.toContain(peer.id);
  });

  it("hides same-role people from a viewer loading a list", async () => {
    const viewer = await createStudent();
    const peer = await createStudent();
    const researcher = await createResearcher();

    const people = await loadVisiblePeople(viewer, [viewer.id, peer.id, researcher.id]);
    expect(people.has(researcher.id)).toBe(true);
    expect(people.has(viewer.id)).toBe(true);
    expect(people.has(peer.id)).toBe(false);
  });

  it("names people from whichever profile table holds them", async () => {
    const student = await createStudent();
    const researcher = await createResearcher();

    const people = await loadPeople([student.id, researcher.id]);
    expect(people.get(student.id)?.displayName).toBe("Test Student");
    expect(people.get(researcher.id)?.displayName).toBeTruthy();
    expect(people.get(researcher.id)?.role).toBe("researcher");
  });
});
