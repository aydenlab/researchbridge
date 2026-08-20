import type { Metadata } from "next";
import { asc, sql } from "drizzle-orm";
import { db, researchFields, skills, studentSkills } from "@/db";
import { AdminPanel } from "@/components/app/admin-ui";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { requireAdmin } from "@/lib/auth/permissions";
import { AddTaxonomyForm, SkillApprovalToggle } from "./taxonomy-forms";

export const metadata: Metadata = {
  title: "Taxonomies",
  robots: { index: false, follow: false },
};

export default async function AdminTaxonomiesPage() {
  await requireAdmin();

  const [skillRows, fieldRows, usage] = await Promise.all([
    db.select().from(skills).orderBy(asc(skills.name)),
    db.select().from(researchFields).orderBy(asc(researchFields.name)),
    db
      .select({ skillId: studentSkills.skillId, value: sql<number>`count(*)::int` })
      .from(studentSkills)
      .groupBy(studentSkills.skillId),
  ]);

  const usageMap = new Map(usage.map((row) => [row.skillId, row.value]));
  const studentAdded = skillRows.filter((skill) => skill.category === "Student added");

  return (
    <div className="mx-auto max-w-[1080px] px-4 py-8 sm:px-6 sm:py-10">
      <PageHeader
        eyebrow="Admin"
        title="Taxonomies"
        lede="Skills and research fields are data, not a hardcoded list. Students and researchers can add their own, and you decide what stays visible."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <AdminPanel
          title="Skills"
          description={`${skillRows.length} total, ${studentAdded.length} added by users`}
          action={<AddTaxonomyForm kind="skill" />}
        >
          <ul className="max-h-[520px] divide-y divide-line overflow-y-auto rb-scroll">
            {skillRows.map((skill) => (
              <li key={skill.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                <div className="min-w-0">
                  <p className="text-[13.5px] text-ink">{skill.name}</p>
                  <p className="mt-0.5 text-[11.5px] text-subtle">
                    {skill.category ?? "Uncategorized"}, used by {usageMap.get(skill.id) ?? 0}{" "}
                    {(usageMap.get(skill.id) ?? 0) === 1 ? "student" : "students"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {skill.approved ? null : <Badge tone="neutral">Hidden</Badge>}
                  <SkillApprovalToggle skillId={skill.id} approved={skill.approved} />
                </div>
              </li>
            ))}
          </ul>
        </AdminPanel>

        <AdminPanel
          title="Research fields"
          description={`${fieldRows.length} fields`}
          action={<AddTaxonomyForm kind="field" />}
        >
          <ul className="max-h-[520px] divide-y divide-line overflow-y-auto rb-scroll">
            {fieldRows.map((field) => (
              <li key={field.id} className="px-5 py-2.5">
                <p className="text-[13.5px] text-ink">{field.name}</p>
                <p className="mt-0.5 font-mono text-[11.5px] text-subtle">{field.slug}</p>
              </li>
            ))}
          </ul>
        </AdminPanel>
      </div>
    </div>
  );
}
