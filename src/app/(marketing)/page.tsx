import Link from "next/link";
import { ArrowRight, Mail, Network, ScrollText } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { FaqList } from "@/components/marketing/faq";
import { Hero } from "@/components/marketing/hero";
import { DiscoveryMock, EvidenceMock, PipelineMock } from "@/components/marketing/product-mocks";
import { Reveal } from "@/components/marketing/reveal";

const SWITCH_BLOCKS = [
  {
    eyebrow: "COLD EMAILS",
    headline: "0",
    trailing: "cold emails needed to find an opening that exists",
    body: "Students stop guessing which labs are recruiting. Every listing on ResearchBridge is a position a researcher opened on purpose, with the requirements, time commitment, and compensation stated before anyone applies.",
  },
  {
    eyebrow: "PROJECT FIT",
    headline: "Per project",
    trailing: "criteria, written by the researcher who runs it",
    body: "Different projects need different students. A researcher decides what matters for their own position, marks each item required or preferred, and sets how much weight it carries. Nothing is hidden from applicants.",
  },
  {
    eyebrow: "EVIDENCE",
    headline: "Evidence",
    trailing: "instead of a score you cannot interrogate",
    body: "Applications arrive organized around the criteria that were set. Availability and coursework are checked in code. Written responses are summarized with the passages they came from. The researcher makes every decision.",
  },
];

const STUDENT_STEPS = [
  { step: "01", title: "Create your profile", body: "Coursework, skills, research interests, availability, and any prior experience. You fill this in once." },
  { step: "02", title: "Explore open research", body: "Filter by field, department, compensation, hours, location, and whether the position accepts beginners." },
  { step: "03", title: "Apply to specific projects", body: "Your profile comes along automatically. You answer only the questions this researcher asked." },
  { step: "04", title: "Hear directly from researchers", body: "Track status from one page. When a researcher wants to talk, they reach out to you." },
];

const RESEARCHER_STEPS = [
  { step: "01", title: "Post a position", body: "Describe the project, the student role, the time commitment, and the compensation category." },
  { step: "02", title: "Define what matters", body: "Set required conditions and preferred criteria with plain-language importance levels." },
  { step: "03", title: "Review structured applications", body: "Every applicant answered the same project questions, with evidence tied to your criteria." },
  { step: "04", title: "Contact students you want to meet", body: "Move a candidate forward, keep private notes, and close the position when it is filled." },
];

const PROBLEMS = [
  { Icon: Mail, title: "Cold emails", body: "Students write to researchers who may not be recruiting, and researchers sort through messages that are not tied to any open position." },
  { Icon: ScrollText, title: "Faculty pages", body: "Directory pages describe research interests, not whether a lab has room for a student this term." },
  { Icon: Network, title: "Word of mouth", body: "Positions get filled through existing contacts, which is hardest on students who do not already have a network." },
];

export default function HomePage() {
  return (
    <>
      <Hero />

      <section className="px-5 pb-16 pt-28 sm:px-6 sm:pb-20 sm:pt-40 lg:pb-28 lg:pt-52">
        <div className="mx-auto grid max-w-5xl items-start gap-12 lg:grid-cols-2 lg:gap-20">
          <div>
            <Reveal>
              <p className="mb-6 text-[13px] font-medium tracking-[0.14px] text-subtle">WHAT RESEARCHBRIDGE IS</p>
            </Reveal>
            <Reveal delay={80}>
              <h2
                className="mb-8 font-display text-3xl text-ink sm:text-4xl md:text-5xl"
                style={{ fontWeight: 400, lineHeight: 1.08, letterSpacing: "-0.5px" }}
              >
                One profile. Real openings. Project-specific applications.
              </h2>
            </Reveal>
            <Reveal delay={140}>
              <div className="space-y-4 text-base" style={{ color: "#4d524d", lineHeight: 1.6, letterSpacing: "0.18px" }}>
                <p>
                  ResearchBridge brings the research positions at a university into one place. Students build a profile
                  once, browse projects that are actively recruiting, and apply to the specific work that interests
                  them.
                </p>
                <p>
                  Researchers post a position, state what the project needs, and receive applications already organized
                  around those requirements.
                </p>
              </div>
            </Reveal>
          </div>

          <Reveal delay={100} className="h-[350px] w-full sm:h-[370px] lg:h-[400px]">
            <div
              className="rb-drift flex h-full items-center justify-center rounded-2xl p-4 sm:p-6"
              style={{ backgroundImage: "url(/gradient-sand.webp)", backgroundSize: "160% 160%" }}
            >
              <DiscoveryMock />
            </div>
          </Reveal>
        </div>
      </section>

      <section className="px-5 py-16 sm:px-6 sm:py-20 lg:py-28">
        <div className="mx-auto max-w-5xl">
          <Reveal>
            <p className="mb-6 text-[13px] font-medium tracking-[0.14px] text-subtle">THE PROBLEM TODAY</p>
          </Reveal>
          <Reveal delay={60}>
            <h2
              className="mb-10 max-w-2xl font-display text-3xl text-ink sm:text-4xl"
              style={{ fontWeight: 400, lineHeight: 1.1, letterSpacing: "-0.5px" }}
            >
              Research recruiting still runs on channels that were never built for it.
            </h2>
          </Reveal>

          <div className="border-t border-line">
            {PROBLEMS.map((item, index) => (
              <Reveal key={item.title} delay={index * 70}>
                <div className="grid items-start gap-4 border-b border-line py-7 sm:grid-cols-[220px_1fr] sm:gap-10">
                  <div className="flex items-center gap-2.5">
                    <item.Icon className="size-4 text-forest" aria-hidden="true" />
                    <p className="font-display text-[19px] text-ink">{item.title}</p>
                  </div>
                  <p className="rb-measure text-[15px] leading-7 text-muted">{item.body}</p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={120}>
            <p className="rb-measure mt-8 text-[15px] leading-7 text-muted">
              None of this is anyone's fault. Researchers are busy and students cannot see inside a lab. ResearchBridge
              replaces the guessing with a list of positions that are genuinely open.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="px-5 py-16 sm:px-6 sm:py-20 lg:py-28">
        <div className="mx-auto max-w-5xl">
          <Reveal>
            <p className="mb-6 text-[13px] font-medium tracking-[0.14px] text-subtle">WHY TEAMS USE IT</p>
          </Reveal>
          <Reveal delay={60}>
            <h2
              className="mb-14 max-w-3xl font-display text-3xl text-ink sm:text-4xl md:text-5xl"
              style={{ fontWeight: 400, lineHeight: 1.08, letterSpacing: "-0.5px" }}
            >
              Find research the way it should have worked all along.
            </h2>
          </Reveal>

          <div className="flex flex-col gap-14">
            {SWITCH_BLOCKS.map((block, index) => (
              <Reveal key={block.eyebrow} delay={index * 80}>
                <div className="grid gap-6 border-t border-line pt-8 lg:grid-cols-[1fr_1fr] lg:gap-16">
                  <div>
                    <p className="mb-4 text-[12px] font-medium uppercase tracking-[0.14em] text-subtle">
                      {block.eyebrow}
                    </p>
                    <p
                      className="font-display text-[38px] text-ink sm:text-[46px]"
                      style={{ fontWeight: 400, lineHeight: 1.05, letterSpacing: "-1px" }}
                    >
                      {block.headline}
                    </p>
                    <p className="mt-2 max-w-sm text-[15px] leading-6 text-muted">{block.trailing}</p>
                  </div>
                  <p className="rb-measure text-[15px] leading-7 text-muted lg:pt-9">{block.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-16 sm:px-6 sm:py-20 lg:py-24">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <div
              className="rb-drift rounded-3xl p-5 sm:p-10 lg:p-14"
              style={{ backgroundImage: "url(/gradient-slate.webp)", backgroundSize: "150% 150%" }}
            >
              <div className="grid items-center gap-8 lg:grid-cols-[0.85fr_1fr] lg:gap-14">
                <div>
                  <p className="mb-5 text-[12px] font-medium uppercase tracking-[0.14em] text-white/75">
                    The researcher view
                  </p>
                  <h2
                    className="mb-5 font-display text-3xl text-white sm:text-4xl"
                    style={{ fontWeight: 400, lineHeight: 1.1, letterSpacing: "-0.5px", textShadow: "0 2px 20px rgba(0,0,0,0.15)" }}
                  >
                    See the evidence, not a mystery number.
                  </h2>
                  <p className="text-[15px] leading-7 text-white/85">
                    Availability, coursework, year of study, and listed skills are checked in code. Written responses
                    are organized around the criteria you set, with the passage each observation came from. Nothing
                    tells you who to accept.
                  </p>
                  <p className="mt-5 text-[13.5px] leading-6 text-white/70">
                    For positions that may constitute paid employment, automated ordering of candidates is switched
                    off entirely.
                  </p>
                </div>
                <EvidenceMock />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="px-5 py-16 sm:px-6 sm:py-20 lg:py-28">
        <div className="mx-auto grid max-w-5xl items-start gap-12 lg:grid-cols-2 lg:gap-20">
          <Reveal className="order-2 h-[350px] w-full sm:h-[380px] lg:order-1 lg:h-[420px]">
            <div
              className="rb-drift flex h-full items-center justify-center rounded-2xl p-4 sm:p-6"
              style={{ backgroundImage: "url(/gradient-meadow.webp)", backgroundSize: "160% 160%" }}
            >
              <PipelineMock />
            </div>
          </Reveal>

          <div className="order-1 lg:order-2">
            <Reveal>
              <p className="mb-6 text-[13px] font-medium tracking-[0.14px] text-subtle">FOR RESEARCHERS</p>
            </Reveal>
            <Reveal delay={60}>
              <h2
                className="mb-8 font-display text-3xl text-ink sm:text-4xl md:text-[44px]"
                style={{ fontWeight: 400, lineHeight: 1.08, letterSpacing: "-0.5px" }}
              >
                Spend less time sorting cold emails.
              </h2>
            </Reveal>
            <Reveal delay={110}>
              <ul className="flex flex-col gap-3 text-[15px] leading-7 text-muted">
                {[
                  "Structured applications instead of a mixed inbox.",
                  "Project-specific questions you write yourself.",
                  "Student profiles with coursework, skills, and availability already filled in.",
                  "Criterion evidence tied to the requirements you set.",
                  "One place to review candidates, keep private notes, and close the position.",
                ].map((line) => (
                  <li key={line} className="flex gap-3">
                    <ArrowRight className="mt-1.5 size-3.5 shrink-0 text-forest" aria-hidden="true" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </Reveal>
            <Reveal delay={160}>
              <div className="mt-8 flex flex-wrap gap-3">
                <ButtonLink href="/researchers/interest">Recruit students</ButtonLink>
                <ButtonLink href="/for-researchers" variant="outline">
                  See how posting works
                </ButtonLink>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="px-5 py-16 sm:px-6 sm:py-20 lg:py-28">
        <div className="mx-auto max-w-5xl">
          <Reveal>
            <p className="mb-6 text-[13px] font-medium tracking-[0.14px] text-subtle">HOW IT WORKS</p>
          </Reveal>

          <div className="grid gap-14 lg:grid-cols-2 lg:gap-20">
            <div>
              <Reveal delay={40}>
                <h3 className="mb-8 font-display text-[26px] text-ink" style={{ fontWeight: 400, letterSpacing: "-0.4px" }}>
                  For students
                </h3>
              </Reveal>
              <ol className="border-t border-line">
                {STUDENT_STEPS.map((item, index) => (
                  <Reveal key={item.step} delay={index * 60} as="li">
                    <div className="grid grid-cols-[44px_1fr] gap-4 border-b border-line py-5">
                      <span className="font-mono text-[13px] text-subtle">{item.step}</span>
                      <div>
                        <p className="text-[15.5px] font-medium text-ink">{item.title}</p>
                        <p className="mt-1 text-[14px] leading-6 text-muted">{item.body}</p>
                      </div>
                    </div>
                  </Reveal>
                ))}
              </ol>
            </div>

            <div>
              <Reveal delay={40}>
                <h3 className="mb-8 font-display text-[26px] text-ink" style={{ fontWeight: 400, letterSpacing: "-0.4px" }}>
                  For researchers
                </h3>
              </Reveal>
              <ol className="border-t border-line">
                {RESEARCHER_STEPS.map((item, index) => (
                  <Reveal key={item.step} delay={index * 60} as="li">
                    <div className="grid grid-cols-[44px_1fr] gap-4 border-b border-line py-5">
                      <span className="font-mono text-[13px] text-subtle">{item.step}</span>
                      <div>
                        <p className="text-[15.5px] font-medium text-ink">{item.title}</p>
                        <p className="mt-1 text-[14px] leading-6 text-muted">{item.body}</p>
                      </div>
                    </div>
                  </Reveal>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </section>

      <section className="px-5 py-16 sm:px-6 sm:py-20 lg:py-24">
        <div className="mx-auto max-w-5xl">
          <Reveal>
            <div className="grid gap-8 rounded-2xl border border-line bg-cream/70 p-7 sm:p-10 lg:grid-cols-[1fr_1fr] lg:gap-14">
              <div>
                <p className="mb-4 text-[12px] font-medium uppercase tracking-[0.14em] text-subtle">Beginners</p>
                <h2
                  className="font-display text-[28px] text-ink sm:text-[34px]"
                  style={{ fontWeight: 400, lineHeight: 1.12, letterSpacing: "-0.5px" }}
                >
                  You do not need research experience to start.
                </h2>
              </div>
              <div className="space-y-4 text-[15px] leading-7 text-muted">
                <p>
                  Many positions are written for students who have never worked in a lab. The researcher controls the
                  requirements for their own project, and listings state clearly whether prior research is required,
                  preferred, or not required at all.
                </p>
                <p>
                  A missing preferred item affects only that item. It does not quietly disqualify an application, and
                  it is never hidden from you.
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="px-5 py-16 sm:px-6 sm:py-20 lg:py-24">
        <div className="mx-auto max-w-5xl">
          <Reveal>
            <div
              className="rb-drift rounded-3xl px-6 py-14 text-center sm:px-10 sm:py-20"
              style={{ backgroundImage: "url(/gradient-ink.webp)", backgroundSize: "150% 150%" }}
            >
              <h2
                className="mx-auto max-w-2xl font-display text-3xl text-white sm:text-4xl md:text-[46px]"
                style={{ fontWeight: 400, lineHeight: 1.1, letterSpacing: "-0.8px", textShadow: "0 2px 20px rgba(0,0,0,0.2)" }}
              >
                Stop sending cold emails into the void.
              </h2>
              <p className="mx-auto mt-5 max-w-xl text-[15px] leading-7 text-white/80">
                The first ResearchBridge pilot runs at McMaster University in September 2026, starting with Health
                Sciences and Life Sciences. Students take part for free.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <ButtonLink href="/waitlist" size="lg" variant="onDark">
                  Join the McMaster pilot
                </ButtonLink>
                <ButtonLink
                  href="/researchers/interest"
                  size="lg"
                  className="border border-white/35 bg-white/10 text-white hover:bg-white/20"
                >
                  I am recruiting students
                </ButtonLink>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="px-5 pb-24 pt-8 sm:px-6 sm:pb-28">
        <div className="mx-auto max-w-4xl">
          <Reveal>
            <h2
              className="mb-8 font-display text-3xl text-ink sm:text-4xl"
              style={{ fontWeight: 400, letterSpacing: "-0.5px" }}
            >
              FAQs
            </h2>
          </Reveal>
          <Reveal delay={60}>
            <FaqList />
          </Reveal>
          <Reveal delay={100}>
            <p className="mt-8 text-[14px] text-muted">
              Something not answered here?{" "}
              <Link href="/contact" className="underline decoration-line-strong underline-offset-4 hover:text-ink">
                Get in touch
              </Link>
              .
            </p>
          </Reveal>
        </div>
      </section>
    </>
  );
}
