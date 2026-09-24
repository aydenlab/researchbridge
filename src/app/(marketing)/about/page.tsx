import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { ContentSection, PageHero, Prose } from "@/components/marketing/page-hero";
import { Reveal } from "@/components/marketing/reveal";

export const metadata: Metadata = {
  title: "About",
  description:
    "ResearchBridge connects students with research opportunities at their university and gives researchers a structured way to find candidates for a project.",
  alternates: { canonical: "/about" },
};

const PRINCIPLES = [
  {
    title: "Relevance belongs to the project, not the student",
    body: "A student can be an excellent fit for one project and a poor fit for the next. ResearchBridge evaluates every application only in the context of the position it was sent to. There is no universal student score and no leaderboard.",
  },
  {
    title: "Requirements are stated before anyone applies",
    body: "Researchers write their own criteria and mark each one required or preferred. Students see those criteria on the listing. Nothing is scored in secret.",
  },
  {
    title: "The researcher decides",
    body: "Software can organize an application and point to the passage where something appears. It does not decide who gets a position. For roles that may constitute paid employment, automated ordering of candidates is switched off.",
  },
  {
    title: "Starting out is normal",
    body: "Plenty of research positions suit students who have never worked in a lab. Requirements are set per project, and beginner-friendly positions are labelled as such.",
  },
];

export default function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow="About"
        title="Research positions should be findable."
        lede="ResearchBridge is a platform that connects students with research opportunities at their university."
        gradient="gradient-meadow"
      />

      <ContentSection>
        <Reveal>
          <Prose>
            <p>
              Rather than searching faculty pages and sending cold emails to researchers who may not be recruiting,
              students create a single profile and apply to positions that are currently open.
            </p>
            <p>
              In the team's experience, many university research positions are filled informally through contacts and
              word of mouth, which makes them harder to access for students without an existing network.
              ResearchBridge brings those opportunities together and gives researchers a structured way to find
              students who fit the needs of a project.
            </p>
            <p>
              The product is deliberately narrow. It is not a social network, a messaging platform, or a directory of
              every professor at a university. It is a place where open research positions live, and where an
              application is written for one specific project.
            </p>
          </Prose>
        </Reveal>
      </ContentSection>

      <ContentSection eyebrow="What we hold to" title="Four commitments that shape the product.">
        <div className="border-t border-line">
          {PRINCIPLES.map((item, index) => (
            <Reveal key={item.title} delay={index * 60}>
              <div className="grid gap-3 border-b border-line py-7 sm:grid-cols-[1fr_1.3fr] sm:gap-12">
                <p className="font-display text-[20px] leading-7 text-ink">{item.title}</p>
                <p className="text-[15px] leading-7 text-muted">{item.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </ContentSection>

      <ContentSection eyebrow="The pilot" title="Starting with one university, then expanding.">
        <Reveal>
          <Prose>
            <p>
              The first pilot will run in health and life sciences, with a small number of researchers and students at
              a single university. Undergraduate and graduate students can both take part, and students use
              ResearchBridge for free.
            </p>
            <p>
              ResearchBridge is an independent product. Partner institutions and research groups are not yet
              confirmed, so none are named here. Nothing on this site should be read as an endorsement by any
              university.
            </p>
            <p>
              The architecture already models institutions, email domains, faculties, departments, and grading scales
              as data, so expansion to further faculties and other universities does not require rebuilding the
              product.
            </p>
          </Prose>
        </Reveal>
        <Reveal delay={80}>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/signup">Sign up as a student</ButtonLink>
            <ButtonLink href="/contact" variant="outline">
              Contact the team
            </ButtonLink>
          </div>
        </Reveal>
      </ContentSection>
    </>
  );
}
