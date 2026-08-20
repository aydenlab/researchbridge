import { ButtonLink } from "@/components/ui/button";
import { PartnerBelt } from "./partner-belt";
import { RotatingPhrase } from "./rotating-phrase";

const PHRASES = [
  "cardiovascular outcomes",
  "neuroimaging",
  "the microbiome",
  "cancer cell biology",
  "health policy",
  "rehabilitation science",
];

export function Hero() {
  return (
    <section className="relative px-4 pb-0 pt-2 sm:px-6">
      <div
        className="rb-drift relative flex min-h-[calc(100vh-60px)] flex-col overflow-hidden rounded-t-3xl"
        style={{
          backgroundImage: "url(/gradient-hero.webp)",
          backgroundSize: "115% 115%",
          backgroundRepeat: "no-repeat",
        }}
      >
        <div className="flex flex-1 items-center justify-center px-5 pb-8 pt-12 text-center sm:px-6 sm:pb-10 sm:pt-20">
          <div className="relative z-10 mx-auto max-w-4xl">
            <span
              className="mb-10 inline-flex items-center gap-2 rounded-full px-4 py-2 backdrop-blur-md"
              style={{
                backgroundColor: "rgba(255, 255, 255, 0.25)",
                boxShadow: "rgba(0,0,0,0.08) 0px 0px 0px 0.5px inset",
              }}
            >
              <span className="size-1.5 rounded-full bg-[#e0b855]" aria-hidden="true" />
              <span className="text-[13px] font-medium tracking-[0.14px] text-white">
                Pilot launching at McMaster University in September 2026
              </span>
            </span>

            <h1
              className="mb-4 font-display text-3xl text-white sm:text-4xl md:text-5xl lg:text-[64px]"
              style={{ fontWeight: 400, lineHeight: 1.12, letterSpacing: "-0.8px", textShadow: "0 2px 20px rgba(0,0,0,0.15)" }}
            >
              Looking for research on <RotatingPhrase phrases={PHRASES} />?
            </h1>

            <p
              className="mb-9 font-display text-sm sm:text-base md:text-lg lg:text-xl"
              style={{
                color: "rgba(255,255,255,0.9)",
                fontWeight: 400,
                letterSpacing: "-0.25px",
                lineHeight: 1.35,
                textShadow: "0 1px 12px rgba(0,0,0,0.12)",
              }}
            >
              See who is actually recruiting. ResearchBridge brings open university research positions into one place,
              so you build one profile and apply directly to the projects that interest you.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <ButtonLink href="/waitlist" size="lg" variant="onDark">
                Join the McMaster pilot
              </ButtonLink>
              <ButtonLink
                href="/researchers/interest"
                size="lg"
                className="border border-white/35 bg-white/15 text-white backdrop-blur-md hover:bg-white/25"
              >
                I am recruiting students
              </ButtonLink>
            </div>
          </div>
        </div>

        <PartnerBelt />
      </div>
    </section>
  );
}
