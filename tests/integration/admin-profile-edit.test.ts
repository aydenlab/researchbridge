import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, researcherFields, researcherProfiles, users } from "@/db";
import { ensureResearchField } from "@/lib/queries/taxonomy";
import { createOpportunity, createResearcher } from "../fixtures";

/**
 * The guarantees the admin edit screen leans on. The screen itself refuses a
 * duplicate address and an account with postings before it writes anything;
 * these are the checks underneath that, which hold even if the screen is wrong.
 */
describe("editing a researcher profile as an administrator", () => {
  it("keeps the profile when the sign-in address is corrected", async () => {
    const researcher = await createResearcher();
    const corrected = `corrected-${randomUUID().slice(0, 8)}@example.edu`;

    await db.update(users).set({ email: corrected }).where(eq(users.id, researcher.id));

    const rows = await db
      .select({ email: users.email, firstName: researcherProfiles.firstName })
      .from(users)
      .innerJoin(researcherProfiles, eq(researcherProfiles.userId, users.id))
      .where(eq(users.id, researcher.id))
      .limit(1);

    expect(rows[0]?.email).toBe(corrected);
    expect(rows[0]?.firstName).toBe("Test");
  });

  it("refuses to give one account an address another already uses", async () => {
    const first = await createResearcher();
    const second = await createResearcher();

    await expect(db.update(users).set({ email: first.email }).where(eq(users.id, second.id))).rejects.toThrow();
  });

  it("takes the profile and its research areas with the account when it is deleted", async () => {
    const researcher = await createResearcher();
    const fieldId = await ensureResearchField("Comparative Test Studies");
    await db.insert(researcherFields).values({ researcherId: researcher.id, researchFieldId: fieldId });

    await db.delete(users).where(eq(users.id, researcher.id));

    const profile = await db.select().from(researcherProfiles).where(eq(researcherProfiles.userId, researcher.id));
    const areas = await db.select().from(researcherFields).where(eq(researcherFields.researcherId, researcher.id));
    expect(profile).toHaveLength(0);
    expect(areas).toHaveLength(0);
  });

  it("will not let an account with a published position be deleted out from under it", async () => {
    const researcher = await createResearcher();
    await createOpportunity(researcher.id);

    // Why the screen checks for postings first: the database refuses this, and
    // without the check an admin would see a failure with no explanation.
    await expect(db.delete(users).where(eq(users.id, researcher.id))).rejects.toThrow();
  });
});
