import type { Metadata } from "next";
import Link from "next/link";
import { ContentSection, PageHero } from "@/components/marketing/page-hero";
import { LegalList, LegalNotice, LegalSection } from "@/components/marketing/legal";

export const metadata: Metadata = {
  title: "Accessibility",
  description: "How ResearchBridge is built to be usable, what is not finished, and how to report a barrier.",
  alternates: { canonical: "/accessibility" },
};

const UPDATED = "20 August 2026";

export default function AccessibilityPage() {
  return (
    <>
      <PageHero
        eyebrow="Accessibility"
        title="Usable by everyone applying to research."
        lede="What ResearchBridge does today, what is not finished, and how to tell us when something blocks you."
        gradient="gradient-sand"
      />

      <ContentSection>
        <LegalNotice updated={UPDATED} />

        <LegalSection title="Our commitment">
          <p>
            Finding research should not depend on how you read a page or operate a computer. We build toward the Web
            Content Accessibility Guidelines version 2.1 at level AA as our working standard, and we treat an
            accessibility barrier as a bug rather than a feature request.
          </p>
          <p>
            We have not completed a third-party audit, so we describe this as our target rather than as certified
            conformance.
          </p>
        </LegalSection>

        <LegalSection title="What the product does today">
          <p>Structure and navigation:</p>
          <LegalList
            items={[
              "Pages are built from semantic HTML with real headings, lists, buttons, and landmarks, so screen readers can navigate by structure.",
              "Every interactive element is reachable and operable by keyboard, in an order that follows the visible layout.",
              "Focus is always visible, using a high-contrast outline rather than a removed or faint indicator.",
              "Multi-step flows show which step you are on, and let you move back without losing what you entered.",
            ]}
          />
          <p>Forms:</p>
          <LegalList
            items={[
              "Every field has a real label that is programmatically associated with it, not a placeholder standing in for one.",
              "Optional fields are marked as optional, so nothing is required implicitly.",
              "Errors are announced, described in words, and say what to do next rather than only that something is invalid.",
              "Application drafts save automatically, so a slow or interrupted session does not lose written work.",
            ]}
          />
          <p>Content and colour:</p>
          <LegalList
            items={[
              "State is never carried by colour alone. Application status, criterion outcomes, and required fields all carry a text label.",
              "Colour combinations are chosen against the WCAG 2.1 AA contrast targets for body and interface text.",
              "Text resizes with browser and operating system settings, because sizing uses relative units.",
              "Copy avoids jargon where plain words work, and explains what a status means rather than assuming the reader knows.",
            ]}
          />
          <p>Motion and layout:</p>
          <LegalList
            items={[
              "Motion is limited to gentle background drift and short reveals, and all of it is switched off when your system requests reduced motion.",
              "Nothing flashes, auto-plays, or moves in a way that could trigger a seizure.",
              "Layouts are responsive rather than scaled down. Dense researcher tables become readable cards on small screens instead of scrolling sideways.",
              "There are no time limits on completing an application.",
            ]}
          />
        </LegalSection>

        <LegalSection title="Known gaps">
          <p>We would rather name these than imply the product is finished.</p>
          <LegalList
            items={[
              "No formal third-party accessibility audit or certification has been carried out.",
              "Screen reader testing has been done against the markup rather than as a full certification pass across every assistive technology.",
              "Files that students and researchers upload, such as papers, resumes, and transcripts, are not remediated by ResearchBridge. Their accessibility depends on the original document.",
              "Papers attached to a listing open on the publisher's own site, which we do not control.",
              "Where a researcher enables a video response, recording is done with a tool of the student's choosing, so its accessibility depends on that tool.",
            ]}
          />
        </LegalSection>

        <LegalSection title="If something blocks you">
          <p>
            Write to hello@myresearchbridge.com with the page, what you were trying to do, and the assistive technology
            and browser you were using. Accessibility reports are treated as bugs and prioritized accordingly.
          </p>
          <p>
            If a barrier stops you from applying to a position before its deadline, say so in your message. We will
            work with the researcher so that the barrier does not cost you the opportunity.
          </p>
          <p>
            We aim to acknowledge reports within three working days and to say what we intend to do about them, even
            when a fix will take longer.
          </p>
        </LegalSection>

        <LegalSection title="Alternatives">
          <p>
            If any part of ResearchBridge is unusable for you, contact us and we will find another way for you to take
            part in the pilot, including collecting your profile and application by email and entering it on your
            behalf.
          </p>
          <p>
            See also the{" "}
            <Link href="/privacy" className="underline decoration-line-strong underline-offset-4 hover:text-ink">
              Privacy Policy
            </Link>{" "}
            and the{" "}
            <Link href="/terms" className="underline decoration-line-strong underline-offset-4 hover:text-ink">
              Terms of Service
            </Link>
            .
          </p>
        </LegalSection>
      </ContentSection>
    </>
  );
}
