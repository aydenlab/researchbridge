import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, researcherFields, researcherProfiles, researchFields } from "@/db";
import { Avatar } from "@/components/app/avatar";
import { PageHeader } from "@/components/app/page-header";
import { Badge, Tag } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/permissions";
import { formatDate, formatMonth } from "@/lib/format";
import { formatMetric } from "@/lib/gpa";
import {
  COMPENSATION_PREFERENCE_LABELS,
  COURSE_STATUS_LABELS,
  COURSE_TYPE_LABELS,
  DEGREE_LABELS,
  DURATION_LABELS,
  LOCATION_LABELS,
  PROFICIENCY_LABELS,
  PROGRAM_CATEGORY_LABELS,
  RESEARCHER_TYPE_LABELS,
  VERIFICATION_LABELS,
  labelOr,
} from "@/lib/labels";
import { loadStudentProfile, missingProfileItems, toAcademicMetrics } from "@/lib/queries/student";
import { listProfileReferences, MAX_PROFILE_REFERENCES } from "@/lib/queries/references";
import { listReferralsFor } from "@/lib/queries/referrals";
import { ProfileReferences } from "./profile-references";

export const metadata: Metadata = {
  title: "Profile",
  robots: { index: false, follow: false },
};

function Panel({
  title,
  editHref,
  editLabel = "Edit",
  children,
}: {
  title: string;
  editHref?: string;
  editLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[12px] border border-line bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
        <h2 className="font-display text-[18px] text-ink">{title}</h2>
        {editHref ? (
          <Link href={editHref} className="text-[13px] text-forest underline decoration-line-strong underline-offset-4 hover:text-ink">
            {editLabel}
          </Link>
        ) : null}
      </div>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

function Rows({ rows }: { rows: { label: string; value: string }[] }) {
  return (
    <dl className="divide-y divide-line">
      {rows.map((row) => (
        <div key={row.label} className="grid gap-1 py-2.5 first:pt-0 last:pb-0 sm:grid-cols-[190px_1fr] sm:gap-4">
          <dt className="text-[12.5px] text-subtle">{row.label}</dt>
          <dd className="text-[14px] leading-6 text-ink">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export default async function ProfilePage() {
  const user = await requireUser();
  if (!user.role) redirect("/onboarding");
  if (user.role === "admin") redirect("/admin");

  const [profileReferenceRows, referrals] = await Promise.all([
    listProfileReferences(user.id),
    listReferralsFor(user.id),
  ]);

  if (user.role === "researcher") {
    const rows = await db.select().from(researcherProfiles).where(eq(researcherProfiles.userId, user.id)).limit(1);
    const profile = rows[0];
    if (!profile) redirect("/onboarding/researcher");

    const fields = await db
      .select({ name: researchFields.name })
      .from(researcherFields)
      .innerJoin(researchFields, eq(researchFields.id, researcherFields.researchFieldId))
      .where(eq(researcherFields.researcherId, user.id));

    return (
      <div className="mx-auto max-w-[880px] px-4 py-8 sm:px-6 sm:py-10">
        <Avatar
          fileId={profile.photoFileId}
          name={`${profile.firstName} ${profile.lastName}`}
          className="mb-4 size-20 text-[28px]"
        />
        <PageHeader
          eyebrow="Researcher profile"
          title={`${profile.firstName} ${profile.lastName}`}
          lede="Students see this alongside every position you post."
          actions={
            <>
              <Badge tone={profile.verificationStatus === "verified" ? "ok" : "warn"}>
                {labelOr(VERIFICATION_LABELS, profile.verificationStatus)}
              </Badge>
              <ButtonLink href="/onboarding/researcher?step=1" variant="outline">
                Edit profile
              </ButtonLink>
            </>
          }
        />

        <div className="flex flex-col gap-5">
          <Panel title="Details" editHref="/onboarding/researcher?step=1">
            <Rows
              rows={[
                { label: "Email", value: user.email },
                { label: "Institution", value: user.institutionName ?? "Not set" },
                { label: "Role", value: labelOr(RESEARCHER_TYPE_LABELS, profile.researcherType) },
                { label: "Title", value: profile.title ?? "Not set" },
                { label: "Faculty", value: profile.faculty ?? "Not set" },
                { label: "Department", value: profile.department ?? "Not set" },
                { label: "Lab or group", value: profile.labName ?? "Not set" },
                { label: "Research page", value: profile.personalWebsite ?? "Not set" },
                { label: "LinkedIn", value: profile.linkedinUrl ?? "Not set" },
                { label: "ORCID iD", value: profile.orcidId ?? "Not set" },
                { label: "Contact email", value: profile.contactEmail ?? user.email },
                ...(profile.prefilledSource
                  ? [
                      {
                        label: "Details imported from",
                        value: `${profile.prefilledSource.replace(/_/g, " ")}${profile.claimedAt ? ", confirmed by you" : ", not yet confirmed"}`,
                      },
                    ]
                  : []),
              ]}
            />
          </Panel>

          <Panel title="Research areas" editHref="/onboarding/researcher?step=1">
            {fields.length === 0 ? (
              <p className="text-[13.5px] text-muted">No research areas selected.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {fields.map((field) => (
                  <Tag key={field.name}>{field.name}</Tag>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="What you are looking for" editHref="/onboarding/researcher?step=1">
            {profile.recruitingNeeds ? (
              <p className="rb-measure whitespace-pre-line text-[14.5px] leading-7 text-muted">
                {profile.recruitingNeeds}
              </p>
            ) : (
              <p className="text-[13.5px] leading-6 text-muted">
                Not set. Students read this before anything else on your profile.
              </p>
            )}
          </Panel>

          <Panel title="Biography" editHref="/onboarding/researcher?step=1">
            <p className="rb-measure text-[14.5px] leading-7 text-muted">{profile.biography ?? "Not set"}</p>
          </Panel>

          <ProfileReferences references={profileReferenceRows} max={MAX_PROFILE_REFERENCES} />
        </div>
      </div>
    );
  }

  const bundle = await loadStudentProfile(user.id);
  if (!bundle) redirect("/onboarding/student");

  const metrics = toAcademicMetrics(bundle.academicRecords);
  const missing = missingProfileItems(bundle);

  return (
    <div className="mx-auto max-w-[880px] px-4 py-8 sm:px-6 sm:py-10">
      <PageHeader
        eyebrow="Student profile"
        title={`${bundle.profile.preferredName ?? bundle.profile.firstName} ${bundle.profile.lastName}`}
        lede="This travels with every application you send. Researchers see it next to your answers."
        actions={
          <ButtonLink href="/onboarding/student?step=1" variant="outline">
            Edit profile
          </ButtonLink>
        }
      />

      <div className="mb-5 rounded-[12px] border border-line bg-white px-5 py-4">
        <div className="flex items-center justify-between gap-4">
          <p className="text-[14px] font-medium text-ink">Profile completeness</p>
          <p className="font-mono text-[14px] text-forest">{bundle.profile.profileCompletion} percent</p>
        </div>
        <div
          role="progressbar"
          aria-valuenow={bundle.profile.profileCompletion}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Profile completeness"
          className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-line"
        >
          <div className="h-full rounded-full bg-forest" style={{ width: `${bundle.profile.profileCompletion}%` }} />
        </div>
        {missing.length > 0 ? (
          <p className="mt-3 text-[13px] leading-6 text-muted">Not filled in yet: {missing.join(", ")}.</p>
        ) : (
          <p className="mt-3 text-[13px] leading-6 text-muted">Everything researchers commonly ask for is filled in.</p>
        )}
      </div>

      <div className="flex flex-col gap-5">
        <Panel title="Basics" editHref="/onboarding/student?step=1">
          <Rows
            rows={[
              { label: "Email", value: user.email },
              { label: "Institution", value: user.institutionName ?? "Not set" },
              { label: "Program", value: bundle.profile.program ?? "Not set" },
              { label: "Program area", value: labelOr(PROGRAM_CATEGORY_LABELS, bundle.profile.programCategory) },
              { label: "Degree level", value: labelOr(DEGREE_LABELS, bundle.profile.degreeLevel) },
              { label: "Faculty", value: bundle.profile.faculty ?? "Not set" },
              { label: "Specialization", value: bundle.profile.specialization ?? "Not set" },
              { label: "Year of study", value: bundle.profile.yearLevel ? `Year ${bundle.profile.yearLevel}` : "Not set" },
              { label: "Expected graduation", value: bundle.profile.graduationYear ? String(bundle.profile.graduationYear) : "Not set" },
            ]}
          />
        </Panel>

        <Panel title="Academics" editHref="/onboarding/student?step=2">
          {metrics.length === 0 ? (
            <p className="text-[13.5px] leading-6 text-muted">
              You have not shared an academic average. Researchers decide whether it matters for their own project, and
              many do not ask for it.
            </p>
          ) : (
            <Rows rows={metrics.map((metric, index) => ({ label: bundle.academicRecords[index]?.label ?? "Average", value: formatMetric(metric) }))} />
          )}

          <div className="mt-4 border-t border-line pt-4">
            <p className="text-[12.5px] text-subtle">Coursework</p>
            {bundle.courses.length === 0 ? (
              <p className="mt-1.5 text-[13.5px] text-muted">None listed.</p>
            ) : (
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {bundle.courses.map((course) => (
                  <li key={course.id}>
                    <Tag>
                      {course.courseCode}
                      {course.status !== "completed" ? ` (${labelOr(COURSE_STATUS_LABELS, course.status).toLowerCase()})` : ""}
                    </Tag>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {bundle.profile.distinctions ? (
            <div className="mt-4 border-t border-line pt-4">
              <p className="text-[12.5px] text-subtle">Distinctions</p>
              <p className="mt-1.5 text-[14px] leading-6 text-muted">{bundle.profile.distinctions}</p>
            </div>
          ) : null}
        </Panel>

        <Panel title="Skills" editHref="/onboarding/student?step=3">
          {bundle.skills.length === 0 ? (
            <p className="text-[13.5px] text-muted">No skills listed yet.</p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {bundle.skills.map((skill) => (
                <li key={skill.id} className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                  <span className="text-[14px] font-medium text-ink">{skill.name}</span>
                  {skill.proficiency ? (
                    <Badge tone="outline">{labelOr(PROFICIENCY_LABELS, skill.proficiency)}</Badge>
                  ) : null}
                  {skill.context ? <span className="text-[13px] text-muted">{skill.context}</span> : null}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Research interests" editHref="/onboarding/student?step=4">
          {bundle.fields.length === 0 ? (
            <p className="text-[13.5px] text-muted">No research interests listed yet.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {bundle.fields.map((field) => (
                <Tag key={field.id}>{field.name}</Tag>
              ))}
            </div>
          )}
          {bundle.profile.researchInterestSummary ? (
            <p className="rb-measure mt-4 border-t border-line pt-4 text-[14.5px] leading-7 text-muted">
              {bundle.profile.researchInterestSummary}
            </p>
          ) : null}
        </Panel>

        <Panel title="Research experience" editHref="/onboarding/student?step=5">
          {bundle.experiences.length === 0 ? (
            <p className="text-[13.5px] leading-6 text-muted">
              No research experience listed. That is fine. Many positions are written for students with none, and the
              researcher sets the requirements for each project.
            </p>
          ) : (
            <ul className="flex flex-col gap-5">
              {bundle.experiences.map((experience) => (
                <li key={experience.id} className="border-t border-line pt-4 first:border-t-0 first:pt-0">
                  <p className="text-[15px] font-medium text-ink">
                    {experience.title ?? "Research role"} at {experience.organization}
                  </p>
                  <p className="mt-0.5 text-[12.5px] text-subtle">
                    {formatMonth(experience.startDate)} to {formatMonth(experience.endDate)}
                    {experience.supervisor ? `, supervised by ${experience.supervisor}` : ""}
                  </p>
                  {experience.description ? (
                    <p className="rb-measure mt-2 text-[14px] leading-7 text-muted">{experience.description}</p>
                  ) : null}
                  {(experience.techniques ?? []).length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {(experience.techniques ?? []).map((technique) => (
                        <Tag key={technique}>{technique}</Tag>
                      ))}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Availability and fit" editHref="/onboarding/student?step=6">
          <Rows
            rows={[
              {
                label: "Placement length",
                value: bundle.durations.map((value) => DURATION_LABELS[value]).join(", ") || "Not set",
              },
              {
                label: "Paid or volunteer",
                value:
                  bundle.compensationPreferences.map((value) => COMPENSATION_PREFERENCE_LABELS[value]).join(", ") ||
                  "Not set",
              },
              {
                label: "Course type",
                value: bundle.courseTypes.map((value) => COURSE_TYPE_LABELS[value]).join(", ") || "Not stated",
              },
              { label: "Hours per week", value: bundle.profile.weeklyHours !== null ? String(bundle.profile.weeklyHours) : "Not set" },
              { label: "Location preference", value: labelOr(LOCATION_LABELS, bundle.profile.locationPreference) },
              { label: "Desired start", value: bundle.profile.desiredStartDate ? formatDate(bundle.profile.desiredStartDate) : "Not set" },
              { label: "Semesters", value: (bundle.profile.semesters ?? []).join(", ") || "Not set" },
              { label: "Summer research", value: bundle.profile.summerAvailable ? "Available full time" : "Not stated" },
              { label: "Schedule notes", value: bundle.profile.scheduleNotes ?? "None" },
            ]}
          />
          <p className="mt-4 border-t border-line pt-4 text-[13px] leading-6 text-muted">
            Placement length and whether you need paid work are both matching dimensions. A position that does not
            overlap with what you chose is ranked lower, never hidden from you.
          </p>
        </Panel>

        <Panel title="Referrals">
          {referrals.length === 0 ? (
            <p className="text-[13.5px] leading-6 text-muted">
              Nobody has referred you yet. A referral is added by somebody with an account here, and their name appears
              alongside it on your public profile.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {referrals.map((referral) => (
                <li key={referral.id} className="border-b border-line pb-3 last:border-b-0 last:pb-0">
                  <p className="text-[14px] text-ink">Referred by {referral.referrerName}</p>
                  {referral.referrerHeadline ? (
                    <p className="mt-0.5 text-[12.5px] text-subtle">{referral.referrerHeadline}</p>
                  ) : null}
                  {referral.note ? <p className="mt-1.5 text-[13.5px] leading-6 text-muted">{referral.note}</p> : null}
                  {referral.letterFileId ? (
                    <p className="mt-1 text-[12.5px] text-subtle">A reference letter is attached.</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Documents and links" editHref="/onboarding/student?step=7">
          <Rows
            rows={[
              {
                label: "Resume",
                value: bundle.profile.resumeFileId
                  ? "Attached. Sent with every application."
                  : "Not uploaded. You will be asked for one when you apply.",
              },
              {
                label: "Writing sample",
                value: bundle.profile.writingSampleFileId ? "Attached" : "Not uploaded",
              },
              {
                label: "Video introduction",
                value: bundle.profile.videoIntroFileId ? "Attached" : "Not uploaded",
              },
              { label: "LinkedIn", value: bundle.profile.linkedinUrl ?? "Not set" },
              { label: "ORCID iD", value: bundle.profile.orcidId ?? "Not set" },
            ]}
          />
          <p className="mt-4 border-t border-line pt-4 text-[13px] leading-6 text-muted">
            A writing sample and a short video are the two things researchers say tell them most about an applicant
            beyond a transcript. Both are optional.
          </p>
        </Panel>

        <ProfileReferences references={profileReferenceRows} max={MAX_PROFILE_REFERENCES} />
      </div>
    </div>
  );
}
