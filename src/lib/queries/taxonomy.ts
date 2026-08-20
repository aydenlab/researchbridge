import { asc, eq, sql } from "drizzle-orm";
import { courses, db, institutionDepartments, institutionFaculties, institutions, researchFields, skills } from "@/db";
import { slugify } from "@/lib/format";

export async function loadInstitution(institutionId: string) {
  const rows = await db.select().from(institutions).where(eq(institutions.id, institutionId)).limit(1);
  return rows[0] ?? null;
}

export async function listResearchFields() {
  return db.select().from(researchFields).orderBy(asc(researchFields.name));
}

export async function listSkills() {
  return db.select().from(skills).where(eq(skills.approved, true)).orderBy(asc(skills.name));
}

export async function listCourses(institutionId: string) {
  return db.select().from(courses).where(eq(courses.institutionId, institutionId)).orderBy(asc(courses.courseCode));
}

export async function listFaculties(institutionId: string) {
  return db
    .select()
    .from(institutionFaculties)
    .where(eq(institutionFaculties.institutionId, institutionId))
    .orderBy(asc(institutionFaculties.sortOrder));
}

export async function listDepartments(institutionId: string) {
  return db
    .select()
    .from(institutionDepartments)
    .where(eq(institutionDepartments.institutionId, institutionId))
    .orderBy(asc(institutionDepartments.name));
}

export async function ensureSkill(name: string): Promise<string> {
  const slug = slugify(name);
  const existing = await db.select({ id: skills.id }).from(skills).where(eq(skills.slug, slug)).limit(1);
  if (existing[0]) return existing[0].id;
  const [created] = await db
    .insert(skills)
    .values({ name: name.trim(), slug, category: "Student added", approved: true })
    .returning({ id: skills.id });
  return created.id;
}

export async function ensureResearchField(name: string): Promise<string> {
  const slug = slugify(name);
  const existing = await db.select({ id: researchFields.id }).from(researchFields).where(eq(researchFields.slug, slug)).limit(1);
  if (existing[0]) return existing[0].id;
  const [created] = await db
    .insert(researchFields)
    .values({ name: name.trim(), slug })
    .returning({ id: researchFields.id });
  return created.id;
}

export async function ensureCourse(institutionId: string, courseCode: string, courseName?: string): Promise<string> {
  const code = courseCode.trim();
  const existing = await db
    .select({ id: courses.id })
    .from(courses)
    .where(sql`lower(${courses.courseCode}) = lower(${code})`)
    .limit(1);
  if (existing[0]) return existing[0].id;
  const [created] = await db
    .insert(courses)
    .values({ institutionId, courseCode: code, courseName: courseName?.trim() || code })
    .returning({ id: courses.id });
  return created.id;
}
