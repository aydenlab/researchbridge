import { ButtonLink } from "@/components/ui/button";

export function EmptyState({
  title,
  body,
  actionHref,
  actionLabel,
  secondaryHref,
  secondaryLabel,
}: {
  title: string;
  body: string;
  actionHref?: string;
  actionLabel?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
}) {
  return (
    <div className="rounded-[12px] border border-line bg-white px-6 py-12 text-center">
      <p className="font-display text-[20px] text-ink">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-[14px] leading-6 text-muted">{body}</p>
      {actionHref && actionLabel ? (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <ButtonLink href={actionHref}>{actionLabel}</ButtonLink>
          {secondaryHref && secondaryLabel ? (
            <ButtonLink href={secondaryHref} variant="outline">
              {secondaryLabel}
            </ButtonLink>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
