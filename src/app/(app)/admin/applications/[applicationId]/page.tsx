import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ApplicationDetail } from "@/components/app/application-detail";
import { StatusPill } from "@/components/app/status-pill";
import { requireApplicationReader } from "@/lib/auth/permissions";
import { STATUS_LABELS, type ApplicationStatus } from "@/lib/application-status";
import { formatDate, formatShortDate } from "@/lib/format";
import { COURSE_TYPE_LABELS, DEGREE_LABELS, labelOr } from "@/lib/labels";
import { log } from "@/lib/log";
import { adminApplications } from "@/lib/queries/admin";
import { loadApplication } from "@/lib/queries/applications";
import { loadStudentProfile } from "@/lib/queries/student";

export const metadata: Metadata = {
  title: "Application",
  robots: { index: false, follow: false },
};

const navLink =
  "inline-flex h-8 items-center gap-1 rounded-full border border-line-strong bg-white px-3 text-[12.5px] text-ink hover:bg-shell";

/**
 * A submitted application read in full by the person running the pilot. It is
 * read-only: moving an application or writing notes stays with the researcher.
 */
export default async function AdminApplicationPage({ params }: { params: Promise<{ applicationId: string }> }) {
  const { applicationId } = await params;
  const user = await requireApplicationReader();

  const bundle = await loadApplication(applicationId);
  if (!bundle || bundle.application.status === "draft") notFound();

  log.info("admin_application_read", { userId: user.id, applicationId });

  const [profile, all] = await Promise.all([loadStudentProfile(bundle.application.studentId), adminApplications()]);

  const index = all.findIndex((row) => row.id === applicationId);
  const previous = index > 0 ? all[index - 1] : null;
  const next = index >= 0 && index < all.length - 1 ? all[index + 1] : null;

  const status = bundle.application.status as ApplicationStatus;
  const displayName = `${bundle.student.preferredName ?? bundle.student.firstName} ${bundle.student.lastName}`;

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-5 px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/admin/applications"
          className="text-[13px] text-muted underline decoration-line-strong underline-offset-4 hover:text-ink"
        >
          All applications
        </Link>
        <nav aria-label="Application navigation" className="flex items-center gap-2">
          {previous ? (
            <Link href={`/admin/applications/${previous.id}`} className={navLink}>
              <ChevronLeft className="size-3.5" aria-hidden="true" />
              Previous
            </Link>
          ) : null}
          {index >= 0 ? (
            <span className="text-[12.5px] text-muted">
              {index + 1} of {all.length}
            </span>
          ) : null}
          {next ? (
            <Link href={`/admin/applications/${next.id}`} className={navLink}>
              Next
              <ChevronRight className="size-3.5" aria-hidden="true" />
            </Link>
          ) : null}
        </nav>
      </div>

      <header className="rounded-[12px] border border-line bg-white px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div className="min-w-0">
            <h1 className="font-display text-[26px] leading-tight text-ink" style={{ letterSpacing: "-0.5px" }}>
              {displayName}
            </h1>
            <p className="mt-1 text-[13.5px] text-muted">
              {bundle.student.program ?? "Program not set"}
              {bundle.student.yearLevel ? `, year ${bundle.student.yearLevel}` : ""}
              {`, ${labelOr(DEGREE_LABELS, bundle.student.degreeLevel).toLowerCase()}`}
            </p>
            <p className="mt-1 text-[13px] text-muted">{bundle.studentEmail}</p>
            <p className="mt-2 text-[13.5px] text-ink">
              Applied to <span className="font-medium">{bundle.opportunity.title}</span> with{" "}
              {bundle.researcher.firstName} {bundle.researcher.lastName}
            </p>
            {bundle.application.courseType ? (
              <p className="mt-1 text-[12.5px] text-forest">
                Applying as: {labelOr(COURSE_TYPE_LABELS, bundle.application.courseType)}
              </p>
            ) : null}
            <p className="mt-0.5 text-[12.5px] text-subtle">Submitted {formatDate(bundle.application.submittedAt)}.</p>
          </div>
          <StatusPill status={status} />
        </div>
      </header>

      <ApplicationDetail bundle={bundle} profile={profile} />

      <section className="rounded-[12px] border border-line bg-white">
        <div className="border-b border-line px-5 py-3.5">
          <h2 className="font-display text-[17px] text-ink">History</h2>
        </div>
        <ol className="flex flex-col gap-2.5 px-5 py-4">
          {bundle.history.map((entry) => (
            <li key={entry.id} className="text-[12.5px] leading-5">
              <p className="font-medium text-ink">{STATUS_LABELS[entry.newStatus as ApplicationStatus]}</p>
              <p className="text-subtle">{formatShortDate(entry.createdAt)}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
