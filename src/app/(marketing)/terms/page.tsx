import type { Metadata } from "next";
import { ContentSection, PageHero } from "@/components/marketing/page-hero";
import { LegalNotice, LegalSection } from "@/components/marketing/legal";

export const metadata: Metadata = {
  title: "Terms",
  description: "The terms under which ResearchBridge is offered during the pilot.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <>
      <PageHero
        eyebrow="Terms"
        title="Using ResearchBridge during the pilot."
        lede="Written in plain language for the pilot. This page is a placeholder pending legal review."
        gradient="gradient-meadow"
      />

      <ContentSection>
        <LegalNotice />

        <LegalSection title="Who may use ResearchBridge">
          <p>
            Accounts are created with an institutional email address belonging to a participating institution.
            Participating institutions are configured by ResearchBridge, and researcher accounts are reviewed by an
            administrator before positions can be published.
          </p>
        </LegalSection>

        <LegalSection title="What students agree to">
          <p>
            Provide accurate information about your program, coursework, skills, experience, and availability. Written
            responses must be your own work as required by the researcher for that position.
          </p>
          <p>You can withdraw an application at any time, and you can stop using ResearchBridge at any time.</p>
        </LegalSection>

        <LegalSection title="What researchers agree to">
          <p>
            Post only genuine research positions that you are authorized to recruit for. Describe the project, the
            student role, the expected hours, the compensation category, and the application requirements accurately.
          </p>
          <p>
            You are responsible for candidate decisions. ResearchBridge organizes evidence relating to criteria you
            set. It does not accept, reject, shortlist, or rank candidates on your behalf.
          </p>
          <p>
            Treat student information as confidential and use it only to evaluate applications to your own positions.
          </p>
        </LegalSection>

        <LegalSection title="Compensation and employment">
          <p>
            ResearchBridge lists paid, unpaid, volunteer, academic-credit, work study, grant-funded, and thesis
            positions. Any arrangement, payment, supervision, or employment relationship is between the student, the
            researcher, and the institution. ResearchBridge is not a party to it and is not an employer or an
            employment agency.
          </p>
        </LegalSection>

        <LegalSection title="Moderation">
          <p>
            ResearchBridge administrators may unpublish a listing, request clarification from a researcher, or disable
            an account that does not meet these terms. Records with applications attached are archived rather than
            deleted so that historical pilot data stays intact.
          </p>
        </LegalSection>

        <LegalSection title="Availability">
          <p>
            ResearchBridge is offered as-is during the pilot. Features may change while the team responds to feedback
            from participating students and researchers.
          </p>
        </LegalSection>
      </ContentSection>
    </>
  );
}
