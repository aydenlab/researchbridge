import type { Metadata } from "next";
import { ContentSection, PageHero } from "@/components/marketing/page-hero";
import { LegalNotice, LegalSection } from "@/components/marketing/legal";

export const metadata: Metadata = {
  title: "Accessibility",
  description: "How ResearchBridge approaches accessibility, and how to report a barrier.",
  alternates: { canonical: "/accessibility" },
};

export default function AccessibilityPage() {
  return (
    <>
      <PageHero
        eyebrow="Accessibility"
        title="Built to be usable by everyone applying to research."
        lede="What we do today, what is not finished, and how to tell us about a barrier."
        gradient="gradient-sand"
      />

      <ContentSection>
        <LegalNotice />

        <LegalSection title="What ResearchBridge does today">
          <p>
            Pages are built from semantic HTML with real headings, lists, buttons, and form labels. Every interactive
            element is reachable by keyboard and shows a visible focus outline.
          </p>
          <p>
            Status is never communicated by colour alone. Application states, criterion outcomes, and required fields
            all carry a text label as well.
          </p>
          <p>
            Motion is limited to gentle background drift and short reveals, and all of it is switched off when the
            operating system requests reduced motion.
          </p>
          <p>
            Colour combinations are chosen against the WCAG 2.1 AA contrast targets for body text and interface text.
          </p>
          <p>
            Layouts are responsive rather than scaled down. Dense researcher tables become readable cards on small
            screens instead of scrolling sideways.
          </p>
        </LegalSection>

        <LegalSection title="Known gaps">
          <p>
            ResearchBridge has not yet been through a formal third-party accessibility audit or a full screen reader
            certification pass. We do not claim conformance we have not verified.
          </p>
          <p>
            Files that researchers or students upload, such as papers and resumes, are not remediated by
            ResearchBridge. Their accessibility depends on the original document.
          </p>
        </LegalSection>

        <LegalSection title="Reporting a barrier">
          <p>
            Write to hello@myresearchbridge.com with the page, what you were trying to do, and the assistive technology
            you were using. Accessibility reports during the pilot are treated as bugs, not feature requests.
          </p>
        </LegalSection>
      </ContentSection>
    </>
  );
}
