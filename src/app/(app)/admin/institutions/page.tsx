import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";
import { db, institutionEmailDomains, institutions } from "@/db";
import { AdminPanel } from "@/components/app/admin-ui";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { requireAdmin } from "@/lib/auth/permissions";
import { InstitutionForm } from "./institution-form";

export const metadata: Metadata = {
  title: "Institutions",
  robots: { index: false, follow: false },
};

export default async function AdminInstitutionsPage() {
  await requireAdmin();

  const rows = await db.select().from(institutions).orderBy(asc(institutions.name));
  const domains = await db.select().from(institutionEmailDomains);
  const domainsByInstitution = new Map<string, string[]>();
  for (const domain of domains) {
    domainsByInstitution.set(domain.institutionId, [
      ...(domainsByInstitution.get(domain.institutionId) ?? []),
      domain.domain,
    ]);
  }

  return (
    <div className="mx-auto max-w-[1080px] px-4 py-8 sm:px-6 sm:py-10">
      <PageHeader
        eyebrow="Admin"
        title="Institutions"
        lede="Institutions, their email domains, and their grading scales are configuration, not code. Adding a university here is all it takes to let its students sign in."
      />

      <div className="flex flex-col gap-6">
        {rows.map((institution) => (
          <AdminPanel
            key={institution.id}
            title={institution.name}
            description={`${institution.location ?? "Location not set"} · ${institution.gpaScaleName ?? "No default grading scale"}`}
            action={
              <div className="flex items-center gap-2">
                {institution.isPilot ? <Badge tone="forest">Pilot institution</Badge> : null}
                <Badge tone={institution.active ? "ok" : "neutral"}>{institution.active ? "Active" : "Inactive"}</Badge>
              </div>
            }
          >
            <div className="px-5 py-4">
              <InstitutionForm
                institution={{
                  id: institution.id,
                  name: institution.name,
                  slug: institution.slug,
                  shortName: institution.shortName ?? "",
                  location: institution.location ?? "",
                  gpaScaleName: institution.gpaScaleName ?? "",
                  gpaScaleMax: institution.gpaScaleMax ?? "",
                  active: institution.active,
                  isPilot: institution.isPilot,
                  domains: (domainsByInstitution.get(institution.id) ?? []).join(", "),
                }}
              />
            </div>
          </AdminPanel>
        ))}

        <AdminPanel title="Add an institution" description="Students with a matching email domain can then verify and sign in.">
          <div className="px-5 py-4">
            <InstitutionForm institution={null} />
          </div>
        </AdminPanel>
      </div>
    </div>
  );
}
