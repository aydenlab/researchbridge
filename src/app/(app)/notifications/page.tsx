import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db, notifications } from "@/db";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { requireUser } from "@/lib/auth/permissions";
import { formatShortDate } from "@/lib/format";
import { MarkAllRead } from "./mark-read";

export const metadata: Metadata = {
  title: "Notifications",
  robots: { index: false, follow: false },
};

export default async function NotificationsPage() {
  const user = await requireUser();

  const rows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, user.id))
    .orderBy(desc(notifications.createdAt))
    .limit(60);

  const unread = rows.filter((row) => row.readAt === null);

  return (
    <div className="mx-auto max-w-[860px] px-4 py-8 sm:px-6 sm:py-10">
      <PageHeader
        title="Notifications"
        lede={unread.length > 0 ? `${unread.length} unread` : "Nothing unread."}
        actions={unread.length > 0 ? <MarkAllRead /> : undefined}
      />

      {rows.length === 0 ? (
        <EmptyState
          title="Nothing here yet."
          body="Updates about your applications and positions appear here as they happen."
        />
      ) : (
        <ul className="overflow-hidden rounded-[12px] border border-line bg-white">
          {rows.map((row) => (
            <li
              key={row.id}
              className={`border-b border-line px-5 py-4 last:border-b-0 ${row.readAt === null ? "bg-moss/30" : ""}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[14.5px] font-medium text-ink">{row.title}</p>
                  {row.body ? <p className="mt-1 text-[13.5px] leading-6 text-muted">{row.body}</p> : null}
                  {row.link ? (
                    <Link
                      href={row.link}
                      className="mt-2 inline-block text-[13px] text-forest underline decoration-line-strong underline-offset-4"
                    >
                      Open
                    </Link>
                  ) : null}
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[12px] text-subtle">{formatShortDate(row.createdAt)}</p>
                  {row.readAt === null ? (
                    <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.1em] text-forest">Unread</p>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
