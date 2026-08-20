import type { Metadata } from "next";
import Link from "next/link";
import { ContentSection, PageHero } from "@/components/marketing/page-hero";
import { FaqList } from "@/components/marketing/faq";
import { Reveal } from "@/components/marketing/reveal";

export const metadata: Metadata = {
  title: "FAQ",
  description: "Common questions about applying to research on ResearchBridge, evaluation, compensation, and the McMaster pilot.",
  alternates: { canonical: "/faq" },
};

export default function FaqPage() {
  return (
    <>
      <PageHero
        eyebrow="FAQ"
        title="Questions students and researchers ask first."
        gradient="gradient-sand"
      />
      <ContentSection>
        <Reveal>
          <FaqList />
        </Reveal>
        <Reveal delay={60}>
          <p className="mt-8 text-[14px] text-muted">
            Still unanswered?{" "}
            <Link href="/contact" className="underline decoration-line-strong underline-offset-4 hover:text-ink">
              Contact the team
            </Link>
            .
          </p>
        </Reveal>
      </ContentSection>
    </>
  );
}
