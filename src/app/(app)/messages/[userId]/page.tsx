import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireOnboardedUser } from "@/lib/auth/permissions";
import { formatShortDate } from "@/lib/format";
import { canMessage, loadThread, markThreadRead } from "@/lib/queries/messages";
import { loadPeople } from "@/lib/queries/social";
import { MessageComposer } from "../message-composer";

export const metadata: Metadata = {
  title: "Conversation",
  robots: { index: false, follow: false },
};

export default async function ThreadPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const viewer = await requireOnboardedUser();
  if (viewer.id === userId) notFound();

  const people = await loadPeople([userId]);
  const person = people.get(userId);
  if (!person || !person.role) notFound();

  const [messages, permission] = await Promise.all([loadThread(viewer.id, userId), canMessage(viewer, userId)]);
  await markThreadRead(viewer.id, userId);

  return (
    <div className="mx-auto flex max-w-[760px] flex-col px-4 py-8 sm:px-6 sm:py-10">
      <nav aria-label="Breadcrumb" className="mb-5">
        <Link
          href="/messages"
          className="inline-flex items-center gap-1.5 text-[13px] text-muted underline decoration-line-strong underline-offset-4 hover:text-ink"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          All messages
        </Link>
      </nav>

      <header className="border-b border-line pb-4">
        <h1 className="font-display text-[24px] text-ink" style={{ letterSpacing: "-0.4px" }}>
          <Link href={`/people/${userId}`} className="hover:text-forest">
            {person.displayName}
          </Link>
        </h1>
        <p className="mt-1 text-[13px] text-muted">
          {[person.headline, person.institutionName].filter(Boolean).join(" · ") || "Profile not filled in yet"}
        </p>
      </header>

      <ol className="flex flex-col gap-3 py-6">
        {messages.length === 0 ? (
          <li className="rounded-[10px] border border-dashed border-line-strong bg-white px-4 py-8 text-center text-[13.5px] text-muted">
            No messages yet. Whatever you write is the first thing they will see from you.
          </li>
        ) : (
          messages.map((message) => {
            const mine = message.senderId === viewer.id;
            return (
              <li key={message.id} className={mine ? "flex justify-end" : "flex justify-start"}>
                <div
                  className={`max-w-[80%] rounded-[12px] border px-4 py-3 ${
                    mine ? "border-[#c9ddd0] bg-moss" : "border-line bg-white"
                  }`}
                >
                  <p className="whitespace-pre-line text-[14.5px] leading-7 text-ink">{message.body}</p>
                  <p className="mt-1.5 text-[11.5px] text-subtle">
                    {mine ? "You" : person.displayName} · {formatShortDate(message.createdAt)}
                  </p>
                </div>
              </li>
            );
          })
        )}
      </ol>

      <div className="border-t border-line pt-5">
        {permission.allowed ? (
          <MessageComposer recipientId={userId} recipientName={person.displayName} />
        ) : (
          <p className="rounded-[10px] border border-line bg-shell px-4 py-3 text-[13.5px] leading-6 text-muted">
            {permission.reason}
          </p>
        )}
      </div>
    </div>
  );
}
