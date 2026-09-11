import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { PageHeader } from "@/components/app/page-header";
import { db, researcherProfiles } from "@/db";
import { isVerifiedResearcher, requireResearcher } from "@/lib/auth/permissions";
import { listResearchFields, listSkills } from "@/lib/queries/taxonomy";
import { SimpleOpportunityForm } from "./simple-form";

export const metadata: Metadata = {
  title: "Post a research position",
  robots: { index: false, follow: false },
};

const UNCATEGORIZED = "Other";

export default async function NewOpportunityPage() {
  const user = await requireResearcher();
  const verified = isVerifiedResearcher(user);

  const [fields, skills, profileRows] = await Promise.all([
    listResearchFields(),
    listSkills(),
    db
      .select({ department: researcherProfiles.department })
      .from(researcherProfiles)
      .where(eq(researcherProfiles.userId, user.id))
      .limit(1),
  ]);

  const grouped = new Map<string, string[]>();
  for (const skill of skills) {
    const category = skill.category ?? UNCATEGORIZED;
    const bucket = grouped.get(category);
    if (bucket) bucket.push(skill.name);
    else grouped.set(category, [skill.name]);
  }
  const skillGroups = [...grouped.entries()]
    .map(([category, names]) => ({ category, skills: names }))
    .sort((a, b) => (a.category === UNCATEGORIZED ? 1 : b.category === UNCATEGORIZED ? -1 : a.category.localeCompare(b.category)));

  return (
    <div className="mx-auto max-w-[860px] px-4 py-10 sm:px-6 sm:py-14">
      <PageHeader
        eyebrow="New position"
        title="Post a research opportunity"
        lede="One page. Describe the project, say what the work needs, and set how much each part of an application counts."
      />

      <SimpleOpportunityForm
        fields={fields.map((field) => ({ id: field.id, name: field.name }))}
        skillGroups={skillGroups}
        department={profileRows[0]?.department ?? ""}
        verified={verified}
      />
    </div>
  );
}
