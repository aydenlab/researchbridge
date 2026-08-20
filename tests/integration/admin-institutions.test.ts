import { describe, expect, it } from "vitest";
import { asc, eq } from "drizzle-orm";
import { db, institutionEmailDomains, institutions } from "@/db";
import { resolveInstitutionForEmail } from "@/lib/auth/codes";

async function createInstitution(values: Partial<typeof institutions.$inferInsert> & { name: string; slug: string }) {
  const [row] = await db.insert(institutions).values(values).returning();
  return row;
}

describe("institution configuration", () => {
  it("stores an institution with only a name and slug, leaving optional fields empty", async () => {
    const row = await createInstitution({ name: "Blank Fields University", slug: `blank-${Date.now()}` });

    expect(row.shortName).toBeNull();
    expect(row.location).toBeNull();
    expect(row.gpaScaleName).toBeNull();
    expect(row.gpaScaleMax).toBeNull();
    expect(row.active).toBe(true);
  });

  it("rejects a non-numeric grading scale maximum at the database boundary", async () => {
    await expect(
      createInstitution({
        name: "Bad Scale University",
        slug: `bad-scale-${Date.now()}`,
        gpaScaleMax: "not-a-number" as unknown as string,
      }),
    ).rejects.toThrow();
  });

  it("accepts a numeric grading scale maximum that is not 4", async () => {
    const row = await createInstitution({
      name: "Twelve Point University",
      slug: `twelve-${Date.now()}`,
      gpaScaleName: "12 point",
      gpaScaleMax: "12",
    });

    expect(Number(row.gpaScaleMax)).toBe(12);
    expect(row.gpaScaleName).toBe("12 point");
  });

  it("makes an email domain resolvable as soon as it is added", async () => {
    const domain = `newschool-${Date.now()}.edu`;
    const row = await createInstitution({ name: "New School University", slug: `newschool-${Date.now()}` });

    expect(await resolveInstitutionForEmail(`someone@${domain}`)).toBeNull();

    await db.insert(institutionEmailDomains).values({ institutionId: row.id, domain });

    const resolved = await resolveInstitutionForEmail(`someone@${domain}`);
    expect(resolved?.name).toBe("New School University");
  });

  it("does not resolve a domain belonging to an inactive institution", async () => {
    const domain = `closed-${Date.now()}.edu`;
    const row = await createInstitution({ name: "Closed University", slug: `closed-${Date.now()}`, active: false });
    await db.insert(institutionEmailDomains).values({ institutionId: row.id, domain });

    expect(await resolveInstitutionForEmail(`someone@${domain}`)).toBeNull();
  });

  it("refuses two institutions sharing a slug", async () => {
    const slug = `duplicate-${Date.now()}`;
    await createInstitution({ name: "First University", slug });
    await expect(createInstitution({ name: "Second University", slug })).rejects.toThrow();
  });

  it("refuses the same email domain on two institutions", async () => {
    const domain = `shared-${Date.now()}.edu`;
    const first = await createInstitution({ name: "Alpha University", slug: `alpha-${Date.now()}` });
    const second = await createInstitution({ name: "Beta University", slug: `beta-${Date.now()}` });

    await db.insert(institutionEmailDomains).values({ institutionId: first.id, domain });
    await expect(
      db.insert(institutionEmailDomains).values({ institutionId: second.id, domain }),
    ).rejects.toThrow();
  });

  it("keeps institutions listable in name order for the admin panel", async () => {
    const rows = await db.select().from(institutions).orderBy(asc(institutions.name));
    const names = rows.map((row) => row.name);
    expect([...names].sort((a, b) => a.localeCompare(b))).toEqual(names);
  });
});
