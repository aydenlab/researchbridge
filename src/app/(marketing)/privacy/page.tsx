import type { Metadata } from "next";
import Link from "next/link";
import { ContentSection, PageHero } from "@/components/marketing/page-hero";
import { LegalList, LegalNotice, LegalSection } from "@/components/marketing/legal";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "What ResearchBridge collects, who can see it, how long it is kept, and how to have it removed.",
  alternates: { canonical: "/privacy" },
};

const UPDATED = "20 August 2026";

export default function PrivacyPage() {
  return (
    <>
      <PageHero
        eyebrow="Privacy Policy"
        title="What we collect, and who can see it."
        lede="ResearchBridge handles academic and application information. This page explains exactly what is stored, who it is shared with, and what you can ask us to do with it."
        gradient="gradient-slate"
      />

      <ContentSection>
        <LegalNotice updated={UPDATED} />

        <LegalSection title="Who we are">
          <p>
            ResearchBridge is an independent product that connects students with open research positions at their
            university. It is operated by the ResearchBridge team and is not owned by, or an official service of, any
            university.
          </p>
          <p>
            For any question about this policy, or to make a request about your information, write to
            hello@myresearchbridge.com from the address on your account.
          </p>
        </LegalSection>

        <LegalSection title="Information you give us">
          <p>Account information, which is required to use ResearchBridge:</p>
          <LegalList
            items={[
              "Your institutional email address, which is also how you sign in.",
              "The institution your email domain belongs to.",
              "Your role on ResearchBridge, which is student, researcher, or administrator.",
            ]}
          />
          <p>Student profile information, which you control and can edit or leave blank:</p>
          <LegalList
            items={[
              "Name, preferred name, program, faculty, specialization, year of study, and expected graduation year.",
              "Relevant coursework, skills and self-reported proficiency, and research interests.",
              "Previous research experience, including organization, supervisor, dates, and what you did.",
              "Availability, including hours per week, semesters, start date, and location preference.",
              "Academic standing, which is optional. Both the value and the scale it was measured on are stored.",
              "A resume or transcript, if you choose to upload one.",
            ]}
          />
          <p>Researcher profile information:</p>
          <LegalList
            items={[
              "Name, role, title, faculty, department, lab or research group, and websites you provide.",
              "A short biography shown to students on your listings.",
              "Your research areas.",
            ]}
          />
          <p>Application information:</p>
          <LegalList
            items={[
              "Your written answers to the questions a researcher wrote for that specific position.",
              "Files you attach to that application.",
              "A snapshot of your profile as it stood when you submitted, so later profile edits do not rewrite what a researcher already received.",
            ]}
          />
          <p>
            Waitlist information, if you join before creating an account: your name, email, program or department, year
            or title, and the research areas you describe.
          </p>
        </LegalSection>

        <LegalSection title="Information we generate">
          <LegalList
            items={[
              "Sign-in records, including when a verification code was requested and when a session began.",
              "Application status history, which records every change and who made it.",
              "Criterion evaluations, which record how your application related to the criteria a researcher set.",
              "Administrative audit records, such as researcher approvals and listing moderation.",
              "Pilot analytics events, such as an application being submitted, used to measure whether the pilot works.",
            ]}
          />
          <p>
            We do not use advertising trackers, third-party analytics scripts, or advertising cookies. The only cookie
            ResearchBridge sets is the one that keeps you signed in.
          </p>
        </LegalSection>

        <LegalSection title="Who can see your information">
          <p>
            <span className="font-medium text-ink">Researchers</span> can see a student profile and application material
            when that student applies to a position the researcher controls. Researchers cannot browse a directory of
            students, cannot see applications submitted to anyone else, and cannot see a student who has not applied to
            them.
          </p>
          <p>
            <span className="font-medium text-ink">Students</span> never see a researcher private note. Notes are
            visible only to the researcher who wrote them and are excluded from data exports.
          </p>
          <p>
            <span className="font-medium text-ink">Administrators</span> can see account records, listings, and
            aggregate pilot statistics in order to approve researcher accounts, moderate listings, and report on the
            pilot. The administrator view of applications deliberately excludes written answers, uploaded files, and
            researcher notes.
          </p>
          <p>
            Student profiles are not published publicly and are not indexed by search engines. Signed-in areas of the
            product are excluded from indexing.
          </p>
        </LegalSection>

        <LegalSection title="Automated processing and Claude">
          <p>
            Exact conditions, such as whether your stated weekly availability meets a minimum, whether a listed course
            appears on your profile, and what year of study you are in, are evaluated by ResearchBridge code. No
            language model is involved in those checks.
          </p>
          <p>
            For written material, ResearchBridge sends the specific application text, the relevant profile fields, and
            the criteria the researcher wrote to the Claude API, operated by Anthropic. Its only task is to locate
            evidence relating to those criteria and point at the passage it came from. We send only what that task
            requires. We do not send authentication secrets, verification codes, private researcher notes, or profile
            fields unrelated to the analysis.
          </p>
          <p>
            The model does not decide who is accepted, shortlisted, or declined, and it does not produce a score,
            ranking, or recommendation. For positions that may constitute paid employment, automated ordering of
            candidates is disabled entirely. A human researcher makes every decision.
          </p>
          <p>
            The model is instructed never to infer or comment on race, ethnicity, national origin, religion, sex,
            gender, sexual orientation, disability, health status, political belief, age beyond a legitimate program
            requirement, socioeconomic background, immigration status, or family circumstances, and never to treat a
            name, photo, accent, or writing style as a signal of background. Its output is validated against a fixed
            schema before a researcher sees it.
          </p>
          <p>
            You can ask for the automated evidence recorded on your own application to be explained. Write to
            hello@myresearchbridge.com and we will describe what was recorded and why.
          </p>
        </LegalSection>

        <LegalSection title="Where your information is stored">
          <p>
            ResearchBridge runs on Railway, which hosts the application and its PostgreSQL database. Written material
            sent for evidence analysis is processed by Anthropic. Transactional email, such as verification codes and
            application notifications, is delivered through an email provider. These providers process information on
            our behalf in order to run the service.
          </p>
          <p>
            Hosting may be located outside your country. If that matters for your circumstances, contact us before
            creating an account.
          </p>
        </LegalSection>

        <LegalSection title="How long we keep it">
          <LegalList
            items={[
              "Verification codes expire after ten minutes and can be used once.",
              "Sign-in sessions expire after thirty days, and signing out ends them immediately.",
              "Applications, their status history, and pilot outcome records are kept for the duration of the pilot so historical records stay accurate.",
              "Opportunities that already have applications are closed or archived rather than deleted, so applicants keep a record of what they applied to.",
              "Waitlist entries are kept until the pilot ends or you ask us to remove them.",
            ]}
          />
        </LegalSection>

        <LegalSection title="Your choices">
          <LegalList
            items={[
              "Most profile fields are optional. Academic standing, a resume, and a transcript are never required to use ResearchBridge.",
              "You can edit or clear profile information at any time from your profile page.",
              "You can withdraw an application at any point.",
              "You can ask for a copy of your information, ask us to correct it, or ask us to delete your account.",
              "You can ask to be removed from the waitlist without creating an account.",
            ]}
          />
          <p>
            To make a request, write to hello@myresearchbridge.com from the address on your account. We aim to respond
            within thirty days. Where deleting information would destroy a record another person relies on, such as an
            application a researcher has already reviewed, we will explain what can be removed and what has to be kept.
          </p>
        </LegalSection>

        <LegalSection title="Security">
          <p>
            Sign-in uses one-time codes rather than passwords. Codes are stored only as a keyed hash, expire after ten
            minutes, can be used once, allow five incorrect attempts, and are rate limited per address. Session tokens
            are random values stored as hashes and delivered in a cookie that scripts on the page cannot read.
          </p>
          <p>
            Access is checked on the server for every page and every action, rather than by hiding links. File downloads
            are authorized per file. Uploads are limited by size and file type.
          </p>
          <p>
            No system is perfectly secure. If you find a vulnerability, please report it to hello@myresearchbridge.com
            before disclosing it publicly, and we will work with you on a fix.
          </p>
        </LegalSection>

        <LegalSection title="Children">
          <p>
            ResearchBridge is intended for university students, researchers, and staff. It is not directed at children,
            and accounts require an institutional email address.
          </p>
        </LegalSection>

        <LegalSection title="What we do not claim">
          <p>
            ResearchBridge does not hold SOC 2, HIPAA, FERPA, or PIPEDA certification, and does not claim official
            approval or endorsement from any university. Any such statement will appear here only once it is true and
            verified.
          </p>
        </LegalSection>

        <LegalSection title="Changes to this policy">
          <p>
            If we change how information is collected or shared in a way that affects you, we will update the date at
            the top of this page and, for material changes, notify account holders by email. Continuing to use
            ResearchBridge after a change means the updated policy applies.
          </p>
          <p>
            See also the{" "}
            <Link href="/terms" className="underline decoration-line-strong underline-offset-4 hover:text-ink">
              Terms of Service
            </Link>{" "}
            and the{" "}
            <Link href="/accessibility" className="underline decoration-line-strong underline-offset-4 hover:text-ink">
              Accessibility statement
            </Link>
            .
          </p>
        </LegalSection>
      </ContentSection>
    </>
  );
}
