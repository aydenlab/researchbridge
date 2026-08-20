import type { Metadata } from "next";
import Link from "next/link";
import { ContentSection, PageHero } from "@/components/marketing/page-hero";
import { Reveal } from "@/components/marketing/reveal";
import { StudentWaitlistForm } from "./waitlist-forms";

export const metadata: Metadata = {
  title: "Join the McMaster pilot",
  description:
    "Join the ResearchBridge student waitlist for the McMaster University pilot launching in September 2026. Students take part for free.",
  alternates: { canonical: "/waitlist" },
};

const POINTS = [
  "Students use ResearchBridge for free.",
  "Previous research experience is not required, and many positions are written for students who have none.",
  "Every listing states its compensation category, hours, and requirements before you apply.",
  "There is no universal student score. Each application is evaluated only against that project's criteria.",
];

export default function WaitlistPage() {
  return (
    <>
      <PageHero
        eyebrow="Student pilot"
        title="Join the McMaster pilot."
        lede="The first ResearchBridge cohort runs in Health Sciences and Life Sciences from September 2026. Joining takes under a minute and does not create an account."
        gradient="gradient-hero"
      />

      <ContentSection>
        <div className="grid gap-10 lg:grid-cols-[1fr_360px] lg:gap-16">
          <Reveal>
            <div className="rounded-[12px] border border-line bg-white p-6 sm:p-8">
              <h2 className="font-display text-[24px] text-ink" style={{ letterSpacing: "-0.4px" }}>
                Add your name
              </h2>
              <p className="mt-2 text-[14.5px] leading-7 text-muted">
                We use this to line up researchers whose projects match what students actually want to work on.
              </p>
              <div className="mt-7">
                <StudentWaitlistForm />
              </div>
            </div>
          </Reveal>

          <Reveal delay={80}>
            <aside className="flex flex-col gap-5">
              <div className="rounded-[12px] border border-line bg-cream/60 p-5">
                <p className="text-[12px] font-medium uppercase tracking-[0.12em] text-subtle">What to expect</p>
                <ul className="mt-3 flex flex-col gap-3">
                  {POINTS.map((point) => (
                    <li key={point} className="text-[13.5px] leading-6 text-muted">
                      {point}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-[12px] border border-line bg-white p-5">
                <p className="text-[14px] font-medium text-ink">Already have a McMaster address?</p>
                <p className="mt-1.5 text-[13.5px] leading-6 text-muted">
                  You can{" "}
                  <Link href="/signin" className="text-forest underline decoration-line-strong underline-offset-4">
                    sign in
                  </Link>{" "}
                  now and build your profile before the cohort opens.
                </p>
              </div>

              <div className="rounded-[12px] border border-line bg-white p-5">
                <p className="text-[14px] font-medium text-ink">Recruiting students instead?</p>
                <p className="mt-1.5 text-[13.5px] leading-6 text-muted">
                  <Link href="/researchers/interest" className="text-forest underline decoration-line-strong underline-offset-4">
                    Register interest as a researcher
                  </Link>{" "}
                  and someone will talk through the positions you might post.
                </p>
              </div>
            </aside>
          </Reveal>
        </div>
      </ContentSection>
    </>
  );
}
