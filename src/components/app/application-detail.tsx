import { FileText } from "lucide-react";
import { Tag } from "@/components/ui/badge";
import { DocumentedEvidenceSummary } from "@/components/app/documented-evidence";
import { VideoEmbed } from "@/components/app/video-embed";
import { formatDate, formatMonth } from "@/lib/format";
import { formatMetric } from "@/lib/gpa";
import { COURSE_STATUS_LABELS, LOCATION_LABELS, PROFICIENCY_LABELS, QUESTION_TYPE_LABELS, labelOr } from "@/lib/labels";
import type { ApplicationBundle } from "@/lib/queries/applications";
import { loadStudentProfile, toAcademicMetrics } from "@/lib/queries/student";
import { splitVideoQuestion, videoFromAnswer, type VideoAnswer } from "@/lib/video-links";

export function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[12px] border border-line bg-white">
      <div className="border-b border-line px-5 py-3.5">
        <h2 className="font-display text-[17px] text-ink">{title}</h2>
        {subtitle ? <p className="mt-1 text-[12px] leading-5 text-muted">{subtitle}</p> : null}
      </div>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

/**
 * The written responses and the student profile that travel with an
 * application, read-only. Shared by the researcher review page and the
 * operator's application reader so both show the same thing.
 */
export function ApplicationDetail({
  bundle,
  profile,
}: {
  bundle: ApplicationBundle;
  profile: Awaited<ReturnType<typeof loadStudentProfile>>;
}) {
  const answersByQuestion = new Map(bundle.answers.map((answer) => [answer.questionId, answer]));
  const metrics = profile ? toAcademicMetrics(profile.academicRecords) : [];
  const { video: videoQuestion, written } = splitVideoQuestion(bundle.questions);
  const videoAnswer = videoQuestion ? answersByQuestion.get(videoQuestion.id)?.structuredAnswer ?? null : null;
  const video = videoFromAnswer(videoAnswer);
  const unplayableLink = !video ? (videoAnswer as VideoAnswer | null)?.externalUrl ?? null : null;
  // A video sent before the request was switched off is still shown; an empty
  // panel for a request that is no longer live is not.
  const showVideo = Boolean(videoQuestion) && (bundle.opportunity.videoResponseEnabled || Boolean(video || unplayableLink));

  return (
    <>
      {showVideo && videoQuestion ? (
        <Panel
          title="Video response"
          subtitle="Hosted on the student's own Loom or YouTube account. Not analyzed, and not part of the fit figure."
        >
          <figure className="mb-4 rounded-[8px] border border-line bg-shell/60 px-3.5 py-2.5">
            <figcaption className="text-[11.5px] text-subtle">
              You asked{videoQuestion.required ? "" : " (optional)"}
            </figcaption>
            <blockquote className="mt-0.5 text-[14px] leading-6 text-ink">{videoQuestion.prompt}</blockquote>
          </figure>
          {video ? (
            <VideoEmbed video={video} title={`Video response from ${bundle.student.preferredName ?? bundle.student.firstName}`} />
          ) : unplayableLink ? (
            <p className="text-[13.5px] leading-6 text-muted">
              The link sent cannot be played here.{" "}
              <a
                href={unplayableLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-forest underline decoration-line-strong underline-offset-4"
              >
                Open it directly
              </a>
              .
            </p>
          ) : (
            <p className="text-[13.5px] leading-6 text-muted">
              {videoQuestion.required ? "No video was attached." : "This applicant chose not to send a video."}
            </p>
          )}
        </Panel>
      ) : null}

      <Panel title="Application responses" subtitle="Written for this position, in the order the questions were asked.">
        {written.length === 0 ? (
          <p className="text-[13.5px] leading-6 text-muted">
            This position asked only for the student profile{showVideo ? " and a video" : ""}, so there are no written
            responses.
          </p>
        ) : (
          <ol className="flex flex-col gap-5">
            {written.map((question, position) => {
              const answer = answersByQuestion.get(question.id);
              const external = (answer?.structuredAnswer as { externalUrl?: string } | null)?.externalUrl;
              return (
                <li key={question.id} className="border-t border-line pt-4 first:border-t-0 first:pt-0">
                  <p className="text-[14px] leading-6 text-ink">
                    <span className="mr-2 font-mono text-[12px] text-subtle">{String(position + 1).padStart(2, "0")}</span>
                    {question.prompt}
                  </p>
                  <p className="mt-1 pl-8 text-[11.5px] text-subtle">
                    {labelOr(QUESTION_TYPE_LABELS, question.type)}
                  </p>
                  <div className="mt-2 pl-8">
                    {answer?.textAnswer ? (
                      <div className="rb-measure whitespace-pre-wrap rounded-[8px] border border-line bg-shell/60 px-3.5 py-3 text-[14px] leading-7 text-muted">
                        {answer.textAnswer}
                      </div>
                    ) : external ? (
                      <a
                        href={external}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[13.5px] text-forest underline decoration-line-strong underline-offset-4"
                      >
                        Open the response the student shared
                      </a>
                    ) : answer?.fileId ? (
                      <a
                        href={`/api/files/by-id/${answer.fileId}`}
                        className="inline-flex items-center gap-1.5 text-[13.5px] text-forest underline decoration-line-strong underline-offset-4"
                      >
                        <FileText className="size-3.5" aria-hidden="true" />
                        Open the attached file
                      </a>
                    ) : (
                      <p className="text-[13.5px] text-subtle">No answer submitted.</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </Panel>

      {profile ? (
        <Panel
          title="What the resume shows"
          subtitle="Research experience, publications, and skills read from the student's resume. Fit and criteria are judged on this."
        >
          <DocumentedEvidenceSummary evidence={profile.documented} audience="researcher" />
        </Panel>
      ) : null}

      <Panel title="Student profile" subtitle="Filled in by the student and included with this application.">
        {profile ? (
          <div className="flex flex-col gap-5">
            <div>
              <p className="text-[12px] font-medium text-subtle">Availability</p>
              <p className="mt-1.5 text-[14px] leading-6 text-ink">
                {profile.profile.weeklyHours !== null ? `${profile.profile.weeklyHours} hours per week` : "Not stated"}{" "}
                {labelOr(LOCATION_LABELS, profile.profile.locationPreference)}, From{" "}
                {formatDate(profile.profile.desiredStartDate)}
              </p>
              {profile.profile.scheduleNotes ? (
                <p className="mt-1 text-[13px] leading-6 text-muted">{profile.profile.scheduleNotes}</p>
              ) : null}
            </div>

            <div className="border-t border-line pt-4">
              <p className="text-[12px] font-medium text-subtle">Research interests</p>
              {profile.fields.length === 0 ? (
                <p className="mt-1.5 text-[13.5px] text-muted">None listed.</p>
              ) : (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {profile.fields.map((field) => (
                    <Tag key={field.id}>{field.name}</Tag>
                  ))}
                </div>
              )}
              {profile.profile.researchInterestSummary ? (
                <p className="rb-measure mt-2.5 text-[14px] leading-7 text-muted">
                  {profile.profile.researchInterestSummary}
                </p>
              ) : null}
            </div>

            <div className="border-t border-line pt-4">
              <p className="text-[12px] font-medium text-subtle">Relevant coursework</p>
              {profile.courses.length === 0 ? (
                <p className="mt-1.5 text-[13.5px] text-muted">None listed.</p>
              ) : (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {profile.courses.map((course) => (
                    <Tag key={course.id}>
                      {course.courseCode} {course.courseName}
                      {course.status !== "completed" ? ` (${labelOr(COURSE_STATUS_LABELS, course.status).toLowerCase()})` : ""}
                    </Tag>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-line pt-4">
              <p className="text-[12px] font-medium text-subtle">Skills the student listed</p>
              <p className="mt-0.5 text-[12px] text-subtle">Self-reported, and not used for matching.</p>
              {profile.skills.length === 0 ? (
                <p className="mt-1.5 text-[13.5px] text-muted">None listed.</p>
              ) : (
                <ul className="mt-2 flex flex-col gap-1.5">
                  {profile.skills.map((skill) => (
                    <li key={skill.id} className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                      <span className="text-[13.5px] font-medium text-ink">{skill.name}</span>
                      {skill.proficiency ? (
                        <span className="text-[12px] text-muted">{labelOr(PROFICIENCY_LABELS, skill.proficiency)}</span>
                      ) : null}
                      {skill.context ? <span className="text-[12.5px] text-muted">{skill.context}</span> : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="border-t border-line pt-4">
              <p className="text-[12px] font-medium text-subtle">Research experience</p>
              {profile.experiences.length === 0 ? (
                <p className="mt-1.5 text-[13.5px] leading-6 text-muted">
                  None listed. This position states that prior research is{" "}
                  {bundle.opportunity.priorResearchRequired ? "required" : "not required"}.
                </p>
              ) : (
                <ul className="mt-2 flex flex-col gap-4">
                  {profile.experiences.map((experience) => (
                    <li key={experience.id}>
                      <p className="text-[14px] font-medium text-ink">
                        {experience.title ?? "Research role"} at {experience.organization}
                      </p>
                      <p className="mt-0.5 text-[12px] text-subtle">
                        {formatMonth(experience.startDate)} to {formatMonth(experience.endDate)}
                        {experience.supervisor ? `, supervised by ${experience.supervisor}` : ""}
                      </p>
                      {experience.description ? (
                        <p className="rb-measure mt-1.5 text-[13.5px] leading-6 text-muted">{experience.description}</p>
                      ) : null}
                      {(experience.techniques ?? []).length > 0 ? (
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {(experience.techniques ?? []).map((technique) => (
                            <Tag key={technique}>{technique}</Tag>
                          ))}
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="border-t border-line pt-4">
              <p className="text-[12px] font-medium text-subtle">Academic standing</p>
              {metrics.length === 0 ? (
                <p className="mt-1.5 text-[13.5px] leading-6 text-muted">
                  Not shared. Sharing an average is optional on ResearchBridge.
                </p>
              ) : (
                <ul className="mt-1.5 flex flex-col gap-1">
                  {metrics.map((metric, position) => (
                    <li key={position} className="text-[14px] text-ink">
                      {profile.academicRecords[position]?.label ?? "Average"}: {formatMetric(metric)}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="border-t border-line pt-4">
              <p className="text-[12px] font-medium text-subtle">Materials</p>
              <ul className="mt-1.5 flex flex-col gap-1.5">
                <li>
                  {profile.profile.resumeFileId ? (
                    <a
                      href={`/api/files/by-id/${profile.profile.resumeFileId}`}
                      className="inline-flex items-center gap-1.5 text-[13.5px] text-forest underline decoration-line-strong underline-offset-4"
                    >
                      <FileText className="size-3.5" aria-hidden="true" />
                      Open the resume
                    </a>
                  ) : (
                    <span className="text-[13.5px] text-muted">No resume.</span>
                  )}
                </li>
                {profile.profile.writingSampleFileId ? (
                  <li>
                    <a
                      href={`/api/files/by-id/${profile.profile.writingSampleFileId}`}
                      className="inline-flex items-center gap-1.5 text-[13.5px] text-forest underline decoration-line-strong underline-offset-4"
                    >
                      <FileText className="size-3.5" aria-hidden="true" />
                      Open the writing sample
                    </a>
                  </li>
                ) : null}
                {profile.profile.videoIntroFileId ? (
                  <li>
                    <a
                      href={`/api/files/by-id/${profile.profile.videoIntroFileId}`}
                      className="inline-flex items-center gap-1.5 text-[13.5px] text-forest underline decoration-line-strong underline-offset-4"
                    >
                      <FileText className="size-3.5" aria-hidden="true" />
                      Watch the video introduction
                    </a>
                  </li>
                ) : null}
                {profile.profile.linkedinUrl ? (
                  <li>
                    <a
                      href={profile.profile.linkedinUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-[13.5px] text-forest underline decoration-line-strong underline-offset-4"
                    >
                      LinkedIn
                    </a>
                  </li>
                ) : null}
                {profile.profile.orcidId ? (
                  <li className="text-[13.5px] text-muted">ORCID {profile.profile.orcidId}</li>
                ) : null}
              </ul>
            </div>
          </div>
        ) : (
          <p className="text-[13.5px] leading-6 text-muted">
            This student's profile is no longer available. The snapshot taken at submission is preserved with the
            application record.
          </p>
        )}
      </Panel>
    </>
  );
}
