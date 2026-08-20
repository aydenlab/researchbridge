import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { ContentSection, PageHero, Prose } from "@/components/marketing/page-hero";
import { PipelineMock } from "@/components/marketing/product-mocks";
import { Reveal } from "@/components/marketing/reveal";

export const metadata: Metadata = {
  title: "For researchers",
  description:
    "Post a research position, define the criteria that matter for your project, and review structured applications in one place.",
  alternates: { canonical: "/for-researchers" },
};

const OFFERS = [
  {
    title: "Structured applications",
    body: "Every applicant answers the same questions you wrote, so responses can be compared without opening a mail client.",
  },
  {
    title: "Project-specific questions",
    body: "Short answers, long responses, numbers, multiple choice, file uploads, and an optional response to a paper you attach.",
  },
  {
    title: "Relevant student profiles",
    body: "Program, year, coursework, skills, prior research, and stated weekly availability, filled in once by the student.",
  },
  {
    title: "Criterion evidence",
    body: "Each criterion you set is shown with the evidence behind it and where that evidence came from.",
  },
  {
    title: "One place to review",
    body: "A split view on desktop with the applicant list beside the candidate, private notes, and status you control.",
  },
];

const WHO = [
  "Professors and principal investigators",
  "Postdoctoral researchers",
  "PhD and master's students",
  "Lab managers and research staff",
  "Students leading legitimate research projects who need collaborators",
];

export default function ForResearchersPage() {
  return (
    <>
      <PageHero
        eyebrow="For researchers"
        title="Spend less time sorting cold emails."
        lede="Post the position once, state what the project actually needs, and review candidates who answered your questions."
        gradient="gradient-hero"
      >
        <div className="flex flex-wrap gap-3">
          <ButtonLink href="/researchers/interest" variant="onDark" size="lg">
            Recruit students
          </ButtonLink>
          <ButtonLink
            href="/how-it-works"
            size="lg"
            className="border border-white/35 bg-white/15 text-white backdrop-blur-md hover:bg-white/25"
          >
            See how posting works
          </ButtonLink>
        </div>
      </PageHero>

      <ContentSection eyebrow="What you get" title="Five things that replace an inbox.">
        <div className="grid gap-10 lg:grid-cols-[1.15fr_1fr] lg:gap-16">
          <div className="border-t border-line">
            {OFFERS.map((item, index) => (
              <Reveal key={item.title} delay={index * 55}>
                <div className="border-b border-line py-6">
                  <p className="font-display text-[19px] text-ink">{item.title}</p>
                  <p className="mt-1.5 text-[14.5px] leading-7 text-muted">{item.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal delay={90} className="h-[380px] lg:h-[440px]">
            <div
              className="rb-drift flex h-full items-center justify-center rounded-2xl p-4 sm:p-6"
              style={{ backgroundImage: "url(/gradient-meadow.webp)", backgroundSize: "160% 160%" }}
            >
              <PipelineMock />
            </div>
          </Reveal>
        </div>
      </ContentSection>

      <ContentSection eyebrow="Criteria" title="You decide what matters, and applicants can see it.">
        <Reveal>
          <Prose>
            <p>
              A criterion is a plain statement of something the project needs. Availability of at least eight hours per
              week. Python or R. A specific course. Prior wet lab work. You mark each one required or preferred, and
              give preferred criteria an importance level of high, medium, or low.
            </p>
            <p>
              Required conditions are evaluated separately from preference weighting, so a student who cannot meet a
              hard requirement is not quietly mixed in with everyone else. Preferred criteria are normalized against
              each other, which means a single preferred item cannot dominate an entire application unless you set it
              up that way.
            </p>
            <p>
              Students see the required and preferred criteria on the listing before they apply. Nothing is scored
              against them that was not disclosed.
            </p>
          </Prose>
        </Reveal>
      </ContentSection>

      <ContentSection eyebrow="Who can post" title="Researcher accounts are reviewed before positions go live.">
        <Reveal>
          <ul className="grid gap-2.5 sm:grid-cols-2">
            {WHO.map((item) => (
              <li key={item} className="rounded-[10px] border border-line bg-white px-4 py-3 text-[14.5px] text-ink">
                {item}
              </li>
            ))}
          </ul>
        </Reveal>
        <Reveal delay={70}>
          <Prose className="mt-8">
            <p>
              Every listing must describe the project, what the student would do, the expected hours, the compensation
              category, and the application requirements. Listings that amount to nothing more than a request to email
              the poster are not published.
            </p>
          </Prose>
        </Reveal>
        <Reveal delay={100}>
          <div className="mt-8">
            <ButtonLink href="/researchers/interest">Recruit students</ButtonLink>
          </div>
        </Reveal>
      </ContentSection>
    </>
  );
}
