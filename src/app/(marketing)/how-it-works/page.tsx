import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { ContentSection, PageHero, Prose } from "@/components/marketing/page-hero";
import { EvidenceMock } from "@/components/marketing/product-mocks";
import { Reveal } from "@/components/marketing/reveal";

export const metadata: Metadata = {
  title: "How it works",
  description:
    "How students apply to open research positions and how researchers post projects, define criteria, and review applications on ResearchBridge.",
  alternates: { canonical: "/how-it-works" },
};

const STUDENT_STEPS = [
  {
    title: "Create your profile",
    body: "Basics, academics, skills, research interests, any prior experience, and your availability. Prior research is optional and plenty of positions are written for students who have none.",
  },
  {
    title: "Browse open positions",
    body: "Search and filter by field, department, compensation, hours per week, location, start term, year level, and whether the position accepts beginners.",
  },
  {
    title: "Apply to specific projects",
    body: "Your profile is included automatically. You answer only the questions this researcher wrote, which may include a response to a recent paper.",
  },
  {
    title: "The researcher reviews your application",
    body: "They see your responses next to the criteria they set for their own project, with the evidence for each one.",
  },
  {
    title: "The researcher contacts selected students",
    body: "You can follow the status of every application from one page, and you can withdraw at any point.",
  },
];

const RESEARCHER_STEPS = [
  { title: "Create a researcher profile", body: "Your role, department, lab, research areas, and a short biography. Researcher accounts are reviewed before a position goes live." },
  { title: "Post a project", body: "The research itself, what the student would actually do, the time commitment, the location, and the compensation category." },
  { title: "Define criteria", body: "Add required conditions and preferred criteria. Required conditions are checked separately from preference weighting." },
  { title: "Add application questions", body: "Short answers, long responses, yes or no, numbers, multiple choice, file uploads, and an optional response to a paper you attach." },
  { title: "Review applicants", body: "Filter, open a candidate, read their responses, see criterion evidence, keep private notes, and update the application status." },
  { title: "Contact candidates", body: "Record that you want to move forward. ResearchBridge notifies the student and keeps an audit event." },
  { title: "Close the opportunity", body: "Mark the position filled or closed. Applications and history are preserved rather than deleted." },
];

export default function HowItWorksPage() {
  return (
    <>
      <PageHero
        eyebrow="How it works"
        title="One profile, real openings, and an application written for the project."
        lede="Criteria vary by position. There is no universal student ranking on ResearchBridge."
        gradient="gradient-slate"
      />

      <ContentSection eyebrow="Students" title="Five steps from profile to a conversation.">
        <ol className="border-t border-line">
          {STUDENT_STEPS.map((item, index) => (
            <Reveal key={item.title} delay={index * 55} as="li">
              <div className="grid grid-cols-[48px_1fr] gap-4 border-b border-line py-6 sm:grid-cols-[64px_1fr] sm:gap-8">
                <span className="font-mono text-[13px] text-subtle">{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <p className="font-display text-[19px] text-ink">{item.title}</p>
                  <p className="mt-1.5 rb-measure text-[14.5px] leading-7 text-muted">{item.body}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </ol>
      </ContentSection>

      <ContentSection eyebrow="Researchers" title="Seven steps from a project to a placement.">
        <ol className="border-t border-line">
          {RESEARCHER_STEPS.map((item, index) => (
            <Reveal key={item.title} delay={index * 45} as="li">
              <div className="grid grid-cols-[48px_1fr] gap-4 border-b border-line py-6 sm:grid-cols-[64px_1fr] sm:gap-8">
                <span className="font-mono text-[13px] text-subtle">{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <p className="font-display text-[19px] text-ink">{item.title}</p>
                  <p className="mt-1.5 rb-measure text-[14.5px] leading-7 text-muted">{item.body}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </ol>
      </ContentSection>

      <ContentSection eyebrow="Evaluation" title="What a researcher actually sees.">
        <div className="grid items-start gap-10 lg:grid-cols-[1fr_1fr] lg:gap-16">
          <Reveal>
            <Prose>
              <p>
                Exact conditions are evaluated in code. Whether a student has ten hours per week available when the
                position asks for eight is arithmetic, not a judgment call, so it is computed directly from the
                profile.
              </p>
              <p>
                Written material is harder. Claude is used to locate evidence in an application that relates to the
                criteria the researcher wrote, and to point at the passage it came from. It never produces a verdict, a
                ranking, or a percentage, and it never infers anything about a person's background.
              </p>
              <p>
                A missing preferred criterion reduces only the share of the preference score attached to that
                criterion. It does not apply a penalty to the rest of the application. Where information is genuinely
                absent, the criterion is marked as not enough information rather than counted as a failure.
              </p>
              <p>
                When Claude is unavailable, applications still submit, criteria still evaluate, and researchers still
                review candidates. The evidence panel simply shows that it is unavailable.
              </p>
            </Prose>
          </Reveal>
          <Reveal delay={80}>
            <EvidenceMock />
          </Reveal>
        </div>
      </ContentSection>

      <ContentSection>
        <Reveal>
          <div className="flex flex-wrap gap-3">
            <ButtonLink href="/signup">Sign up as a student</ButtonLink>
            <ButtonLink href="/opportunities" variant="outline">
              Explore opportunities
            </ButtonLink>
          </div>
        </Reveal>
      </ContentSection>
    </>
  );
}
