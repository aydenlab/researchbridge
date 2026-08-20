import type { Metadata } from "next";
import { ContentSection, PageHero } from "@/components/marketing/page-hero";
import { LegalNotice, LegalSection } from "@/components/marketing/legal";

export const metadata: Metadata = {
  title: "Privacy",
  description: "How ResearchBridge handles student and researcher information during the McMaster pilot.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <>
      <PageHero
        eyebrow="Privacy"
        title="What ResearchBridge collects, and who can see it."
        lede="Written in plain language for the pilot. This page is a placeholder pending legal review."
        gradient="gradient-slate"
      />

      <ContentSection>
        <LegalNotice />

        <LegalSection title="Information we collect">
          <p>
            Account information: your institutional email address, your role on ResearchBridge, and the institution
            your email domain belongs to.
          </p>
          <p>
            Student profile information: name, program, faculty, year of study, expected graduation, coursework,
            skills, research interests, prior research experience, availability, and any academic standing or files you
            choose to add. Academic standing and a resume are optional.
          </p>
          <p>
            Researcher profile information: name, role, department, lab, research areas, websites you provide, and a
            short biography.
          </p>
          <p>
            Application information: the answers you write for a specific position, files you attach to that
            application, and a snapshot of the profile information as it stood when you submitted.
          </p>
          <p>Operational records: sign-in events, application status changes, and administrative actions.</p>
        </LegalSection>

        <LegalSection title="Who can see your information">
          <p>
            A researcher can see a student's profile and application material when that student applies to a position
            the researcher controls. Researchers cannot browse a directory of all students, and they cannot see
            applications submitted to other researchers.
          </p>
          <p>
            Private notes a researcher writes about an application are visible only to that researcher and are never
            shown to students.
          </p>
          <p>
            ResearchBridge administrators can access account and pilot operations data to approve researcher accounts,
            review listings, and report on the pilot.
          </p>
          <p>Student profiles are not published publicly and authenticated pages are excluded from search indexing.</p>
        </LegalSection>

        <LegalSection title="Automated processing">
          <p>
            Exact conditions such as stated weekly availability, listed coursework, and year of study are evaluated by
            ResearchBridge code, not by a language model.
          </p>
          <p>
            For written material, ResearchBridge sends the specific application text, the relevant profile fields, and
            the criteria the researcher wrote to Anthropic's Claude API in order to locate evidence relating to those
            criteria. We do not send authentication secrets, verification codes, private researcher notes, or profile
            fields unrelated to the analysis.
          </p>
          <p>
            The model does not decide who is accepted, shortlisted, or declined. For positions that may constitute paid
            employment, automated ordering of candidates is disabled. A human researcher makes every decision.
          </p>
          <p>
            The model is instructed never to infer or comment on race, ethnicity, religion, sex, gender, sexual
            orientation, disability, political belief, age beyond a legitimate program requirement, or socioeconomic
            background, and never to treat a name, photo, accent, or appearance as a signal.
          </p>
        </LegalSection>

        <LegalSection title="Retention and removal">
          <p>
            Applications, status history, and pilot outcome records are retained so that historical records stay
            accurate. Opportunities with applications are archived or closed rather than deleted.
          </p>
          <p>
            To ask about correcting or removing your information, write to hello@myresearchbridge.com from the address
            on your account.
          </p>
        </LegalSection>

        <LegalSection title="What we do not claim">
          <p>
            ResearchBridge does not currently hold SOC 2, HIPAA, FERPA, or PIPEDA certification, and does not claim
            official approval from any university. Any such statement will only appear here once it is true and
            verified.
          </p>
        </LegalSection>
      </ContentSection>
    </>
  );
}
