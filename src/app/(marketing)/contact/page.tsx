import type { Metadata } from "next";
import { ContentSection, PageHero, Prose } from "@/components/marketing/page-hero";
import { Reveal } from "@/components/marketing/reveal";

export const metadata: Metadata = {
  title: "Contact",
  description: "Reach the ResearchBridge team about the pilot, recruiting students, or joining as a researcher.",
  alternates: { canonical: "/contact" },
};

const ROUTES = [
  { title: "Students", body: "Questions about the pilot, your profile, or an application you submitted." },
  { title: "Researchers", body: "Posting a position, researcher account review, or reviewing applicants." },
  { title: "Universities", body: "Bringing ResearchBridge to your institution." },
];

export default function ContactPage() {
  return (
    <>
      <PageHero
        eyebrow="Contact"
        title="Talk to the team."
        lede="One address reaches everyone working on ResearchBridge."
        gradient="gradient-slate"
      />
      <ContentSection>
        <Reveal>
          <a
            href="mailto:hello@myresearchbridge.com"
            className="inline-flex items-center rounded-[10px] border border-line-strong bg-white px-5 py-4 font-mono text-[16px] text-ink transition-colors hover:border-ink/40 hover:bg-shell sm:text-[19px]"
          >
            hello@myresearchbridge.com
          </a>
        </Reveal>
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {ROUTES.map((route, index) => (
            <Reveal key={route.title} delay={index * 60}>
              <div className="h-full rounded-[10px] border border-line bg-white px-4 py-4">
                <p className="text-[14px] font-medium text-ink">{route.title}</p>
                <p className="mt-1.5 text-[13.5px] leading-6 text-muted">{route.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal delay={120}>
          <Prose className="mt-10">
            <p>
              During the pilot, feedback is collected by email rather than through interruptions inside the product.
              If something is broken or confusing, writing to the address above is the fastest way to reach the people
              who can change it.
            </p>
          </Prose>
        </Reveal>
      </ContentSection>
    </>
  );
}
