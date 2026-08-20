import type { Metadata } from "next";
import Link from "next/link";
import { ContentSection, PageHero } from "@/components/marketing/page-hero";
import { LegalList, LegalNotice, LegalSection } from "@/components/marketing/legal";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The agreement between you and ResearchBridge, covering accounts, listings, applications, and liability.",
  alternates: { canonical: "/terms" },
};

const UPDATED = "20 August 2026";

export default function TermsPage() {
  return (
    <>
      <PageHero
        eyebrow="Terms of Service"
        title="The agreement between you and ResearchBridge."
        lede="Written to be read. If a section is unclear, ask us rather than guessing at what it means."
        gradient="gradient-meadow"
      />

      <ContentSection>
        <LegalNotice updated={UPDATED} />

        <LegalSection title="1. Agreement">
          <p>
            These terms apply when you use ResearchBridge, whether by browsing the site, joining the waitlist, or
            creating an account. Creating an account means you accept them. If you do not accept them, do not create an
            account.
          </p>
          <p>
            ResearchBridge is operated by the ResearchBridge team. It is an independent product and is not an official
            service of any university.
          </p>
        </LegalSection>

        <LegalSection title="2. Who may use ResearchBridge">
          <p>
            Accounts are created with an institutional email address belonging to a participating institution.
            Participating institutions and their email domains are configured by ResearchBridge administrators.
          </p>
          <p>
            You must be able to enter into a binding agreement in your jurisdiction. You may not create an account for
            someone else, share your account, or let another person use it. Because sign-in uses one-time codes sent to
            your email, keeping that mailbox secure is how you keep your account secure.
          </p>
          <p>
            Researcher accounts are reviewed by an administrator before positions can be published. We may decline or
            revoke researcher status if we cannot reasonably establish that an account represents a genuine research
            group.
          </p>
        </LegalSection>

        <LegalSection title="3. What students agree to">
          <LegalList
            items={[
              "Provide accurate information about your program, coursework, skills, experience, and availability.",
              "Submit written responses that are your own work, to the standard the researcher sets for that position.",
              "Apply only to positions you genuinely intend to take up if offered.",
              "Do not submit content that is unlawful, misleading, or that infringes someone else's rights.",
            ]}
          />
          <p>
            You can withdraw an application at any time, and you can stop using ResearchBridge at any time. Withdrawing
            an application notifies the researcher.
          </p>
        </LegalSection>

        <LegalSection title="4. What researchers agree to">
          <LegalList
            items={[
              "Post only genuine research positions that you are authorized to recruit for.",
              "Describe the project, the student role, the expected hours, the compensation category, and the application requirements accurately.",
              "Set criteria that relate to the work, and disclose them on the listing rather than applying undisclosed requirements.",
              "Treat student information as confidential and use it only to evaluate applications to your own positions.",
              "Do not export, share, or repurpose student information outside ResearchBridge without that student's consent.",
              "Respond to applicants within a reasonable period, and close a position once it is filled.",
            ]}
          />
          <p>
            You are responsible for candidate decisions. ResearchBridge organizes evidence relating to criteria you set.
            It does not accept, reject, shortlist, or rank candidates on your behalf, and you must not represent that it
            does.
          </p>
          <p>
            You must comply with your institution's policies on recruiting, supervision, research ethics, and
            employment. Where a position requires ethics approval or a background check, obtaining it is your
            responsibility.
          </p>
        </LegalSection>

        <LegalSection title="5. Compensation and employment">
          <p>
            ResearchBridge lists paid, unpaid, volunteer, academic credit, work study, grant funded, and thesis
            positions. Every listing states its compensation category before a student applies.
          </p>
          <p>
            Any arrangement, payment, supervision, academic credit, or employment relationship is between the student,
            the researcher, and the institution. ResearchBridge is not a party to it. ResearchBridge is not an employer,
            an employment agency, or a placement service, and does not guarantee that any position will be offered,
            funded, or completed.
          </p>
          <p>
            Determining whether a position constitutes employment, and complying with the resulting obligations, rests
            with the researcher and the institution.
          </p>
        </LegalSection>

        <LegalSection title="6. Your content">
          <p>
            You keep ownership of everything you write and upload. You grant ResearchBridge a limited licence to store,
            display, and transmit that content strictly in order to operate the service: showing your application to the
            researcher you applied to, generating criterion evidence for that researcher, and keeping historical
            records accurate.
          </p>
          <p>
            We do not sell your content, use it for advertising, or use it to train models. Written material sent for
            evidence analysis is processed by our AI provider solely to answer that request, as described in the{" "}
            <Link href="/privacy" className="underline decoration-line-strong underline-offset-4 hover:text-ink">
              Privacy Policy
            </Link>
            .
          </p>
        </LegalSection>

        <LegalSection title="7. Acceptable use">
          <p>You agree not to:</p>
          <LegalList
            items={[
              "Scrape, bulk download, or systematically collect listings, profiles, or applications.",
              "Attempt to access accounts, applications, or files that are not yours.",
              "Probe, scan, or disrupt the service, or circumvent rate limits and access checks.",
              "Impersonate another person, a research group, or an institution.",
              "Post spam, or use ResearchBridge to advertise anything that is not a research position.",
              "Submit content designed to manipulate automated evaluation rather than describe your actual experience.",
            ]}
          />
        </LegalSection>

        <LegalSection title="8. Moderation and suspension">
          <p>
            Administrators may unpublish or archive a listing, request clarification from a researcher, or suspend or
            disable an account that does not meet these terms. Where practical we will explain why and give an
            opportunity to correct the problem first.
          </p>
          <p>
            Records that already have applications attached are closed or archived rather than deleted, so that pilot
            data and applicants' records stay intact.
          </p>
        </LegalSection>

        <LegalSection title="9. Availability and changes">
          <p>
            ResearchBridge is offered as it is, without warranties of any kind, express or implied, including any
            implied warranty of merchantability, fitness for a particular purpose, or non-infringement. We do not
            warrant that the service will be uninterrupted, error free, or that it will produce any particular outcome.
          </p>
          <p>
            This is early software running a pilot. Features may change, and the service may be unavailable at times.
            We may change or discontinue features, and we will give notice of significant changes where we reasonably
            can.
          </p>
        </LegalSection>

        <LegalSection title="10. Limitation of liability">
          <p>
            To the fullest extent permitted by law, ResearchBridge and the people who operate it are not liable for
            indirect, incidental, special, consequential, or punitive damages, or for lost opportunities, lost data, or
            lost profits, arising out of your use of the service.
          </p>
          <p>
            Our total liability for any claim relating to the service is limited to the greater of the amount you paid
            us in the twelve months before the claim, which for students is zero, or one hundred Canadian dollars.
          </p>
          <p>
            Nothing in these terms limits liability that cannot be limited by law, including liability for fraud or for
            death or personal injury caused by negligence. Some jurisdictions do not allow certain exclusions, so parts
            of this section may not apply to you.
          </p>
        </LegalSection>

        <LegalSection title="11. Disputes">
          <p>
            These terms are governed by the laws of the Province of Ontario and the federal laws of Canada that apply
            there, without regard to conflict of law rules. The courts of Ontario have jurisdiction, and nothing here
            removes any right you have to bring a claim in your own place of residence where the law gives you that
            right.
          </p>
          <p>
            Before starting a formal dispute, please write to hello@myresearchbridge.com. Most problems are faster to
            resolve directly.
          </p>
        </LegalSection>

        <LegalSection title="12. Ending your use">
          <p>
            You can stop using ResearchBridge at any time and ask us to delete your account. We may end your access if
            you materially breach these terms. Sections that by their nature should survive, including content
            licensing for records already created, limitation of liability, and disputes, continue to apply after your
            account ends.
          </p>
        </LegalSection>

        <LegalSection title="13. Changes to these terms">
          <p>
            We will update the date at the top of this page when these terms change, and notify account holders by
            email of material changes. Continuing to use ResearchBridge after a change means the updated terms apply.
            If you do not accept them, stop using the service and ask us to close your account.
          </p>
          <p>
            Questions about these terms: hello@myresearchbridge.com.
          </p>
        </LegalSection>
      </ContentSection>
    </>
  );
}
