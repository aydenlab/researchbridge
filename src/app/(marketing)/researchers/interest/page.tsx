import type { Metadata } from "next";
import Link from "next/link";
import { ContentSection, PageHero } from "@/components/marketing/page-hero";
import { Reveal } from "@/components/marketing/reveal";
import { ResearcherInterestForm } from "../../waitlist/waitlist-forms";

export const metadata: Metadata = {
  title: "Recruit students",
  description:
    "Register interest in recruiting students through ResearchBridge for the first pilot cohort.",
  alternates: { canonical: "/researchers/interest" },
};

const POINTS = [
  "The first cohort is roughly fifteen researchers in Health Sciences and Life Sciences.",
  "You write the criteria and the questions for your own project.",
  "Applications arrive structured, with evidence tied to what you asked for.",
  "Nothing accepts, declines, or ranks a candidate on your behalf.",
];

const WHO = [
  "Professors and principal investigators",
  "Postdoctoral researchers",
  "PhD and master's students",
  "Lab managers and research staff",
  "Students leading legitimate research projects",
];

export default function ResearcherInterestPage() {
  return (
    <>
      <PageHero
        eyebrow="Researcher interest"
        title="Recruit students for your project."
        lede="Tell us what you work on and what kind of help you need. Someone from the team will follow up before the September 2026 cohort."
        gradient="gradient-slate"
      />

      <ContentSection>
        <div className="grid gap-10 lg:grid-cols-[1fr_340px] lg:gap-16">
          <Reveal>
            <div className="rounded-[12px] border border-line bg-white p-6 sm:p-8">
              <h2 className="font-display text-[24px] text-ink" style={{ letterSpacing: "-0.4px" }}>
                Register interest
              </h2>
              <p className="mt-2 text-[14.5px] leading-7 text-muted">
                This is not an account. It tells us who to contact, and roughly how many students you might take.
              </p>
              <div className="mt-7">
                <ResearcherInterestForm />
              </div>
            </div>
          </Reveal>

          <Reveal delay={80}>
            <aside className="flex flex-col gap-5">
              <div className="rounded-[12px] border border-line bg-cream/60 p-5">
                <p className="text-[12px] font-medium text-subtle">The first cohort</p>
                <ul className="mt-3 flex flex-col gap-3">
                  {POINTS.map((point) => (
                    <li key={point} className="text-[13.5px] leading-6 text-muted">
                      {point}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-[12px] border border-line bg-white p-5">
                <p className="text-[12px] font-medium text-subtle">Who can post</p>
                <ul className="mt-3 flex flex-col gap-2">
                  {WHO.map((item) => (
                    <li key={item} className="text-[13.5px] leading-6 text-muted">
                      {item}
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-[12.5px] leading-5 text-subtle">
                  Every researcher account is reviewed before positions can be published.
                </p>
              </div>

              <div className="rounded-[12px] border border-line bg-white p-5">
                <p className="text-[14px] font-medium text-ink">Ready now?</p>
                <p className="mt-1.5 text-[13.5px] leading-6 text-muted">
                  If you already have an institutional address you can{" "}
                  <Link href="/signin" className="text-forest underline decoration-line-strong underline-offset-4">
                    create an account
                  </Link>{" "}
                  and submit it for review.
                </p>
              </div>
            </aside>
          </Reveal>
        </div>
      </ContentSection>
    </>
  );
}
