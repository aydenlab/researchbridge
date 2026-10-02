import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { ArrowRight, CalendarClock, ClipboardList } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { ButtonLink } from "@/components/ui/button";
import { db, researcherFields, researcherProfiles } from "@/db";
import { isVerifiedResearcher, requireResearcher } from "@/lib/auth/permissions";
import { OTHER_DISCIPLINE_SLUG } from "@/lib/disciplines";
import { FUTURE_OPPORTUNITY_LABEL } from "@/lib/future-opportunity";
import { activeFutureOpportunity } from "@/lib/queries/researcher";
import { listResearchFields, listSkills } from "@/lib/queries/taxonomy";
import { FutureOpportunityForm } from "./future-form";
import { SimpleOpportunityForm } from "./simple-form";

export const metadata: Metadata = {
  title: "Post a research position",
  robots: { index: false, follow: false },
};

const UNCATEGORIZED = "Other";

type Path = "choose" | "defined" | "future";

function readPath(value: string | string[] | undefined): Path {
  if (value === "defined" || value === "future") return value;
  return "choose";
}

/**
 * Posting starts with one question: is there a defined project right now? A
 * researcher with one gets the one-page form. A researcher without one gets a
 * Future Research Opportunity written from their profile, so they can start
 * meeting students without inventing a project to describe.
 */
export default async function NewOpportunityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireResearcher();
  const verified = isVerifiedResearcher(user);
  const path = readPath((await searchParams).project);

  if (path === "choose") return <ChoosePath />;

  const [fields, profileRows] = await Promise.all([
    listResearchFields(),
    db
      .select({
        firstName: researcherProfiles.firstName,
        lastName: researcherProfiles.lastName,
        title: researcherProfiles.title,
        department: researcherProfiles.department,
        labName: researcherProfiles.labName,
        biography: researcherProfiles.biography,
        recruitingNeeds: researcherProfiles.recruitingNeeds,
        disciplines: researcherProfiles.disciplines,
        researchAreaOther: researcherProfiles.researchAreaOther,
      })
      .from(researcherProfiles)
      .where(eq(researcherProfiles.userId, user.id))
      .limit(1),
  ]);
  const profile = profileRows[0];
  const disciplines = (profile?.disciplines ?? []).filter((slug) => slug !== OTHER_DISCIPLINE_SLUG);
  const pickerFields = fields.map((field) => ({ id: field.id, name: field.name, slug: field.slug }));

  if (path === "future") {
    const [existing, areaRows] = await Promise.all([
      activeFutureOpportunity(user.id),
      db
        .select({ id: researcherFields.researchFieldId })
        .from(researcherFields)
        .where(eq(researcherFields.researcherId, user.id)),
    ]);

    return (
      <div className="mx-auto max-w-[1180px] px-4 py-10 sm:px-6 sm:py-14">
        <PageHeader
          eyebrow="No defined project yet"
          title={`Create a ${FUTURE_OPPORTUNITY_LABEL}`}
          lede="We write the posting for you from your profile. Students in your research areas are matched to it, can express interest, and can message you, the same as any other posting. It says plainly that there is no fixed start date or guaranteed position."
        />

        {existing ? (
          <div className="rounded-[12px] border border-line bg-white px-5 py-5 sm:px-6">
            <p className="text-[15px] font-medium text-ink">You already have a {FUTURE_OPPORTUNITY_LABEL} posting.</p>
            <p className="mt-1.5 text-[13.5px] leading-6 text-muted">
              Students are matched to “{existing.title}”. Edit it to change what it says, or close it if you want to start
              a new one.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <ButtonLink href={`/opportunities/${existing.slug}`}>View posting</ButtonLink>
              <ButtonLink href={`/researcher/opportunities/${existing.id}/edit?step=1`} variant="outline">
                Edit posting
              </ButtonLink>
            </div>
          </div>
        ) : (
          <FutureOpportunityForm
            fields={pickerFields}
            disciplines={disciplines}
            areaIds={areaRows.map((row) => row.id)}
            areaOther={profile?.researchAreaOther ?? ""}
            department={profile?.department ?? ""}
            researcher={{
              name: profile ? `${profile.firstName} ${profile.lastName}`.trim() : (user.displayName ?? ""),
              title: profile?.title ?? null,
              labName: profile?.labName ?? null,
              biography: profile?.biography ?? null,
              recruitingNeeds: profile?.recruitingNeeds ?? null,
            }}
            verified={verified}
          />
        )}
      </div>
    );
  }

  const skills = await listSkills();
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

      <p className="-mt-2 mb-6 text-[13px] text-muted">
        No defined project yet?{" "}
        <Link
          href="/researcher/opportunities/new?project=future"
          className="text-ink underline decoration-line-strong underline-offset-4 hover:text-forest"
        >
          Create a {FUTURE_OPPORTUNITY_LABEL} instead
        </Link>
        .
      </p>

      <SimpleOpportunityForm
        fields={pickerFields}
        disciplines={disciplines}
        skillGroups={skillGroups}
        department={profile?.department ?? ""}
        verified={verified}
      />
    </div>
  );
}

function ChoosePath() {
  const option =
    "group flex h-full flex-col rounded-[12px] border border-line bg-white px-5 py-5 transition-colors hover:border-forest/50 hover:bg-moss/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest sm:px-6 sm:py-6";

  return (
    <div className="mx-auto max-w-[860px] px-4 py-10 sm:px-6 sm:py-14">
      <PageHeader
        eyebrow="New posting"
        title="Do you have a defined research project or opportunity right now?"
        lede="Either way, students are matched to your posting, can express interest, and can message you."
      />

      <ul className="grid gap-4 sm:grid-cols-2">
        <li>
          <Link href="/researcher/opportunities/new?project=defined" className={option}>
            <ClipboardList className="size-5 text-forest" aria-hidden="true" />
            <span className="mt-3 font-display text-[19px] leading-7 text-ink">Yes, I have a defined project</span>
            <span className="mt-1.5 flex-1 text-[13.5px] leading-6 text-muted">
              Describe the project, the skills it needs, and the logistics on one page.
            </span>
            <span className="mt-4 inline-flex items-center gap-1.5 text-[13.5px] font-medium text-ink">
              Create a posting
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </span>
          </Link>
        </li>
        <li>
          <Link href="/researcher/opportunities/new?project=future" className={option}>
            <CalendarClock className="size-5 text-forest" aria-hidden="true" />
            <span className="mt-3 font-display text-[19px] leading-7 text-ink">Not right now</span>
            <span className="mt-1.5 flex-1 text-[13.5px] leading-6 text-muted">
              I don’t have a specific project right now, but I’m interested in connecting with strong students for
              future opportunities. We’ll create a {FUTURE_OPPORTUNITY_LABEL} posting for you from your profile.
            </span>
            <span className="mt-4 inline-flex items-center gap-1.5 text-[13.5px] font-medium text-ink">
              Set it up for me
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </span>
          </Link>
        </li>
      </ul>
    </div>
  );
}
