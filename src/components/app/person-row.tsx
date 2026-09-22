import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { PersonSummary } from "@/lib/queries/social";

const ROLE_LABELS: Record<string, string> = {
  student: "Student",
  researcher: "Researcher",
  admin: "Admin",
};

export function PersonRow({ person, action }: { person: PersonSummary; action?: React.ReactNode }) {
  return (
    <li className="flex items-center justify-between gap-4 border-b border-line py-3 last:border-b-0">
      <div className="min-w-0">
        <Link
          href={`/people/${person.id}`}
          className="text-[14.5px] text-ink underline decoration-line-strong underline-offset-4 hover:text-forest"
        >
          {person.displayName}
        </Link>
        <p className="mt-0.5 truncate text-[12.5px] text-subtle">
          {[person.headline, person.institutionName].filter(Boolean).join(", ") || "Profile not filled in yet"}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {person.role ? <Badge tone="neutral">{ROLE_LABELS[person.role] ?? person.role}</Badge> : null}
        {action}
      </div>
    </li>
  );
}
