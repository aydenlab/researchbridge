import { Badge } from "@/components/ui/badge";
import { STATUS_LABELS, STATUS_TONE, type ApplicationStatus } from "@/lib/application-status";

const TONE_MAP = {
  neutral: "neutral",
  active: "outline",
  positive: "forest",
  closed: "neutral",
} as const;

export function StatusPill({ status }: { status: ApplicationStatus }) {
  return <Badge tone={TONE_MAP[STATUS_TONE[status]]}>{STATUS_LABELS[status]}</Badge>;
}
