import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { requireOnboardedUser } from "@/lib/auth/permissions";
import { formatShortDate } from "@/lib/format";
import { listConversations } from "@/lib/queries/messages";

export const metadata: Metadata = {
  title: "Messages",
  robots: { index: false, follow: false },
};

export default async function MessagesPage() {
  const user = await requireOnboardedUser();
  const conversations = await listConversations(user);

  return (
    <div className="mx-auto max-w-[820px] px-4 py-8 sm:px-6 sm:py-10">
      <PageHeader
        title="Messages"
        lede={
          user.role === "researcher"
            ? "You can write to any student directly. Students can only reach you once you follow them back, or once you have opened one of their applications."
            : "You can write to a researcher once you both follow each other, or once they have opened one of your applications. Everyone you have already spoken to stays open."
        }
      />

      {conversations.length === 0 ? (
        <EmptyState
          title="No messages yet."
          body={
            user.role === "researcher"
              ? "Browse students and write to anyone whose work looks relevant. They do not need to have applied to anything."
              : "Follow researchers whose work interests you. When they follow back, you can write to them directly."
          }
          actionHref={user.role === "researcher" ? "/directory/students" : "/directory/researchers"}
          actionLabel={user.role === "researcher" ? "Browse students" : "Browse researchers and labs"}
        />
      ) : (
        <ul className="overflow-hidden rounded-[12px] border border-line bg-white">
          {conversations.map((conversation) => (
            <li key={conversation.person.id} className="border-b border-line last:border-b-0">
              <Link
                href={`/messages/${conversation.person.id}`}
                className="flex items-start justify-between gap-4 px-5 py-4 transition-colors hover:bg-shell/70"
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-[15px] font-medium text-ink">
                    {conversation.person.displayName}
                    {conversation.unread > 0 ? <Badge tone="clay">{conversation.unread} new</Badge> : null}
                  </p>
                  <p className="mt-0.5 truncate text-[12.5px] text-subtle">
                    {[conversation.person.headline, conversation.person.institutionName].filter(Boolean).join(", ")}
                  </p>
                  <p className="rb-measure mt-1.5 line-clamp-2 text-[13.5px] leading-6 text-muted">
                    {conversation.lastFromMe ? "You: " : ""}
                    {conversation.lastMessage}
                  </p>
                </div>
                <p className="shrink-0 text-[12px] text-subtle">{formatShortDate(conversation.lastMessageAt)}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
