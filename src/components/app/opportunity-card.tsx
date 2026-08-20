import Link from "next/link";
import { Bookmark, CalendarClock, Clock, MapPin, Users } from "lucide-react";
import { Badge, Tag } from "@/components/ui/badge";
import { cn } from "@/components/ui/cn";
import { deadlineNote, hoursLabel } from "@/lib/format";
import { COMPENSATION_LABELS, LOCATION_LABELS, PAID_COMPENSATION, labelOr } from "@/lib/labels";
import type { OpportunityListItem } from "@/lib/queries/opportunities";

export function OpportunityCard({
  item,
  saved = false,
  applied = false,
  className,
}: {
  item: OpportunityListItem;
  saved?: boolean;
  applied?: boolean;
  className?: string;
}) {
  const deadline = deadlineNote(item.deadline);
  const paid = PAID_COMPENSATION.has(item.compensationType);

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
            {item.labName ? ` (${item.labName})` : ""}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {applied ? <Badge tone="forest">Applied</Badge> : null}
          {saved ? (
            <span className="inline-flex items-center gap-1 text-[12px] text-muted">
              <Bookmark className="size-3.5 fill-current" aria-hidden="true" />
              Saved
            </span>
          ) : null}
        </div>
      </div>

      <p className="rb-measure mt-2.5 text-[14.5px] leading-6 text-muted">{item.summary}</p>

      <div className="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12.5px] text-muted">
        <span className="inline-flex items-center gap-1.5">
          <Clock className="size-3.5" aria-hidden="true" />
          {hoursLabel(item.hoursPerWeekMin, item.hoursPerWeekMax)}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <MapPin className="size-3.5" aria-hidden="true" />
          {labelOr(LOCATION_LABELS, item.locationMode)}
          {item.location && item.locationMode !== "remote" ? `, ${item.location}` : ""}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Users className="size-3.5" aria-hidden="true" />
          {item.numberOfOpenings} {item.numberOfOpenings === 1 ? "opening" : "openings"}
        </span>
        <span className={cn("inline-flex items-center gap-1.5", deadline.urgent && "text-warn")}>
          <CalendarClock className="size-3.5" aria-hidden="true" />
          {deadline.text}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <Badge tone={paid ? "forest" : "neutral"}>{labelOr(COMPENSATION_LABELS, item.compensationType)}</Badge>
        {item.beginnerFriendly ? <Badge tone="gold">Accepting beginners</Badge> : null}
        {item.priorResearchRequired ? <Badge tone="outline">Prior research required</Badge> : null}
        {item.fieldNames.slice(0, 2).map((field) => (
          <Tag key={field}>{field}</Tag>
        ))}
        {item.skillNames.slice(0, 3).map((skill) => (
          <Tag key={skill}>{skill}</Tag>
        ))}
        {item.skillNames.length > 3 ? <Tag>{`+${item.skillNames.length - 3} more`}</Tag> : null}
      </div>
    </article>
  );
}

export function OpportunityCardSkeleton() {
  return (
    <div className="border-b border-line px-4 py-5 sm:px-5">
      <div className="rb-skeleton h-5 w-2/3 rounded" />
      <div className="rb-skeleton mt-2 h-3.5 w-1/3 rounded" />
      <div className="rb-skeleton mt-3 h-3.5 w-full rounded" />
      <div className="rb-skeleton mt-1.5 h-3.5 w-4/5 rounded" />
      <div className="mt-4 flex gap-2">
        <div className="rb-skeleton h-5 w-24 rounded-full" />
        <div className="rb-skeleton h-5 w-20 rounded-full" />
        <div className="rb-skeleton h-5 w-16 rounded-full" />
      </div>
    </div>
  );
}
