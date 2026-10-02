import { Badge, Tag } from "@/components/ui/badge";
import { describeTrackRecord, PRESENTATION_KINDS, type DocumentedEvidence } from "@/lib/evidence/documented";

const KIND_LABEL: Record<string, string> = {
  peer_reviewed: "Publication",
  preprint: "Preprint",
  manuscript: "Manuscript (not yet published)",
  poster: "Poster",
  oral_presentation: "Oral presentation",
  abstract: "Abstract",
  other: "Other output",
};

const SOURCE_NOTE: Record<DocumentedEvidence["source"], string> = {
  resume_ai: "Read from the resume. Each item quotes the line it came from.",
  resume_text: "Read from the resume text. A more detailed reading runs in the background.",
  profile_only: "No readable resume yet, so this comes from the research experience on the profile.",
};

/**
 * What the resume and research history document. This is what matching reads,
 * so it is shown to the people it affects: the researcher reviewing an
 * application, and the student on their own profile.
 */
export function DocumentedEvidenceSummary({
  evidence,
  audience,
}: {
  evidence: DocumentedEvidence;
  audience: "researcher" | "student";
}) {
  const track = describeTrackRecord(evidence);
  const outputs = evidence.publications;
  const papers = outputs.filter((item) => item.kind === "peer_reviewed" || item.kind === "preprint" || item.kind === "manuscript");
  const presented = outputs.filter((item) => PRESENTATION_KINDS.has(item.kind));

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[12.5px] leading-5 text-muted">
        {SOURCE_NOTE[evidence.source]}{" "}
        {audience === "student"
          ? "Matching uses this rather than the skills you typed, which still appear on your profile."
          : "Matching uses this rather than the self-reported skills list."}
      </p>

      <div>
        <p className="text-[12px] font-medium text-subtle">Research record</p>
        <p className="mt-1 text-[14px] leading-6 text-ink">{track ? `${track[0].toUpperCase()}${track.slice(1)}` : "None found yet"}</p>
        {evidence.summary ? <p className="rb-measure mt-1.5 text-[13.5px] leading-6 text-muted">{evidence.summary}</p> : null}
        {evidence.researchRoles.length > 0 ? (
          <ul className="mt-2 flex flex-col gap-1">
            {evidence.researchRoles.slice(0, 6).map((role, index) => (
              <li key={`${role.role}-${index}`} className="text-[13px] leading-5 text-muted">
                <span className="text-ink">{role.role}</span>
                {role.organization ? `, ${role.organization}` : ""}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {papers.length > 0 || presented.length > 0 ? (
        <div className="border-t border-line pt-3.5">
          <p className="text-[12px] font-medium text-subtle">Publications and presentations</p>
          <ul className="mt-2 flex flex-col gap-2">
            {[...papers, ...presented].slice(0, 10).map((item, index) => (
              <li key={`${item.citation}-${index}`} className="flex flex-col gap-0.5">
                <span>
                  <Badge tone={item.kind === "peer_reviewed" ? "forest" : "outline"}>{KIND_LABEL[item.kind] ?? "Output"}</Badge>
                </span>
                <span className="text-[13px] leading-5 text-muted">{item.citation}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="border-t border-line pt-3.5">
        <p className="text-[12px] font-medium text-subtle">Skills the resume shows</p>
        {evidence.skills.length === 0 ? (
          <p className="mt-1.5 text-[13.5px] text-muted">
            {evidence.hasResume ? "No specific skills recognised yet." : "Upload a resume to have skills read from it."}
          </p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {evidence.skills.slice(0, 30).map((skill) => (
              <span key={skill.name} title={skill.quote ?? undefined}>
                <Tag>{skill.name}</Tag>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
