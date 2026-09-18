import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db, researcherFields, researchFields, researcherProfiles, users } from "@/db";
import { AdminPanel } from "@/components/app/admin-ui";
import { photoUrl } from "@/components/app/avatar";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth/permissions";
import { disciplinesForAreaSlugs } from "@/lib/disciplines";
import { formatShortDate } from "@/lib/format";
import { VERIFICATION_LABELS, labelOr } from "@/lib/labels";
import { listDepartments, listFaculties, listResearchFields } from "@/lib/queries/taxonomy";
import { AdminResearcherForm, DeleteResearcherForm } from "./edit-form";

export const metadata: Metadata = {
  title: "Edit researcher profile",
  robots: { index: false, follow: false },
};

export default async function AdminResearcherEditPage({ params }: { params: Promise<{ userId: string }> }) {
  await requireAdmin();
  const { userId } = await params;

  const rows = await db
    .select({ profile: researcherProfiles, user: users })
    .from(researcherProfiles)
    .innerJoin(users, eq(users.id, researcherProfiles.userId))
    .where(eq(researcherProfiles.userId, userId))
    .limit(1);

  const row = rows[0];
  if (!row) notFound();

  const { profile, user } = row;
  const institutionId = user.institutionId;

  const [fields, faculties, departments, selected] = await Promise.all([
    listResearchFields(),
    institutionId ? listFaculties(institutionId) : Promise.resolve([]),
    institutionId ? listDepartments(institutionId) : Promise.resolve([]),
    db
      .select({ id: researchFields.id, slug: researchFields.slug })
      .from(researcherFields)
      .innerJoin(researchFields, eq(researchFields.id, researcherFields.researchFieldId))
      .where(eq(researcherFields.researcherId, userId)),
  ]);

  const claimed = Boolean(profile.claimedAt);
  const name = [profile.firstName, profile.lastName].filter(Boolean).join(" ") || user.email;

  return (
    <div className="mx-auto max-w-[900px] px-4 py-8 sm:px-6 sm:py-10">
      <PageHeader
        eyebrow="Admin"
        title={name}
        lede="Correct anything that is wrong, including the address this person signs in with."
        actions={
          <>
            <Badge tone={profile.verificationStatus === "verified" ? "ok" : "warn"}>
              {labelOr(VERIFICATION_LABELS, profile.verificationStatus)}
            </Badge>
            <Badge tone={claimed ? "forest" : "neutral"}>{claimed ? "Confirmed by them" : "Not yet claimed"}</Badge>
            <ButtonLink href="/admin/researchers" variant="outline">
              Back
            </ButtonLink>
          </>
        }
      />

      <div className="flex flex-col gap-5">
        <AdminPanel
          title="Profile"
          description={
            profile.prefilledSource
              ? `Imported from ${profile.prefilledSource.replace(/_/g, " ")}${
                  profile.prefilledAt ? ` on ${formatShortDate(profile.prefilledAt)}` : ""
                }`
              : "Filled in by the researcher"
          }
        >
          <AdminResearcherForm
            draft={{
              userId,
              email: user.email,
              firstName: profile.firstName,
              lastName: profile.lastName,
              researcherType: profile.researcherType,
              title: profile.title,
              faculty: profile.faculty,
              department: profile.department,
              labName: profile.labName,
              personalWebsite: profile.personalWebsite,
              linkedinUrl: profile.linkedinUrl,
              orcidId: profile.orcidId,
              contactEmail: profile.contactEmail,
              biography: profile.biography,
              disciplines:
                profile.disciplines.length > 0
                  ? profile.disciplines
                  : disciplinesForAreaSlugs(selected.map((field) => field.slug)),
              disciplineOther: profile.disciplineOther,
              researchAreaOther: profile.researchAreaOther,
              photoUrl: photoUrl(profile.photoFileId),
            }}
            fields={fields.map((field) => ({ id: field.id, name: field.name, slug: field.slug }))}
            selectedFieldIds={selected.map((field) => field.id)}
            faculties={faculties.map((faculty) => faculty.name)}
            departments={departments.map((department) => department.name)}
            claimed={claimed}
          />
        </AdminPanel>

        <AdminPanel title="Delete" description="Permanent. There is no undo.">
          <DeleteResearcherForm userId={userId} email={user.email} />
        </AdminPanel>
      </div>
    </div>
  );
}
