import { cn } from "@/components/ui/cn";

export function photoUrl(fileId: string | null | undefined): string | null {
  return fileId ? `/api/files/by-id/${fileId}` : null;
}

/** A profile photo, or the first letter of the name when there is none. */
export function Avatar({
  fileId,
  name,
  className,
}: {
  fileId: string | null | undefined;
  name: string;
  /** Size and text size, e.g. "size-14 text-[20px]". */
  className?: string;
}) {
  const src = photoUrl(fileId);
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" className={cn("shrink-0 rounded-full border border-line bg-shell object-cover", className)} />;
  }
  return (
    <span
      aria-hidden="true"
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full bg-forest font-medium text-white", className)}
    >
      {(name.trim() || "?").slice(0, 1).toUpperCase()}
    </span>
  );
}
