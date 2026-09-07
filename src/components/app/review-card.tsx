import Link from "next/link";
import { FileSearch } from "lucide-react";
import { Badge, Tag } from "@/components/ui/badge";
import { cn } from "@/components/ui/cn";
import { formatShortDate } from "@/lib/format";
import { REVIEW_TASK_LABELS, labelOr } from "@/lib/labels";
import type { OpportunityListItem } from "@/lib/queries/opportunities";

export function ReviewCard({
  item,
  applied = false,
  className,
}: {
  item: OpportunityListItem;
  applied?: boolean;
  className?: string;
}) {
  return (
    <article
      className={cn(
        "group relative border-b border-line bg-white px-4 py-5 transition-colors hover:bg-shell/70 sm:px-5",
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-[19px] leading-7 text-ink sm:text-[21px]">
            <Link href={`/opportunities/${item.slug}`} className="after:absolute after:inset-0 after:content-['']">
              {item.title}
            </Link>
          </h3>
          <p className="mt-1 text-[13px] text-muted">
            {item.researcherTitle ? `${item.researcherTitle} ` : ""}
            {item.researcherFirstName} {item.researcherLastName}
            {item.department ? `, ${item.department}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {applied ? <Badge tone="forest">Applied</Badge> : null}
          <Badge tone={item.authorshipOffered ? "forest" : "neutral"}>
            {item.authorshipOffered ? "Authorship offered" : "No authorship"}
          </Badge>
        </div>
      </div>

      <p className="rb-measure mt-2.5 text-[14.5px] leading-6 text-muted">{item.summary}</p>

      <div className="mt-3.5 flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1.5 pr-1 text-[12.5px] text-muted">
          <FileSearch className="size-3.5" aria-hidden="true" />
          Help needed with
        </span>
        {item.reviewTasks.map((task) => (
          <Tag key={task}>{labelOr(REVIEW_TASK_LABELS, task)}</Tag>
        ))}
      </div>

      {item.publishedAt ? (
        <p className="mt-2.5 text-[12px] text-subtle">Posted {formatShortDate(item.publishedAt)}</p>
      ) : null}
    </article>
  );
}
