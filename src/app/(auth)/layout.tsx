import Link from "next/link";
import { Logo } from "@/components/marketing/brand";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_0.95fr]">
      <div className="flex flex-col px-5 py-8 sm:px-10 lg:px-14">
        <Link href="/" className="inline-flex self-start transition-opacity hover:opacity-80">
          <Logo priority />
        </Link>

        <div className="flex flex-1 items-center py-10">
          <div className="w-full max-w-[420px]">{children}</div>
        </div>

        <p className="text-[12.5px] text-subtle">
          Trouble signing in? Write to{" "}
          <a href="mailto:hello@myresearchbridge.com" className="underline decoration-line-strong underline-offset-4">
            hello@myresearchbridge.com
          </a>
          .
        </p>
      </div>

      <div className="hidden p-3 lg:block">
        <div
          className="rb-drift flex h-full flex-col justify-end rounded-2xl p-10"
          style={{ backgroundImage: "url(/gradient-hero.webp)", backgroundSize: "150% 150%" }}
        >
          <p
            className="max-w-sm font-display text-[30px] text-white"
            style={{ lineHeight: 1.15, letterSpacing: "-0.6px", textShadow: "0 2px 20px rgba(0,0,0,0.15)" }}
          >
            One profile. Real openings. Project-specific applications.
          </p>
          <p className="mt-4 max-w-sm text-[14px] leading-6 text-white/80">
            The first pilot runs in health and life sciences at a single university, with students taking part for free.
          </p>
        </div>
      </div>
    </div>
  );
}
