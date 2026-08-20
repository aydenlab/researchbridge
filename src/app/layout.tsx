import type { Metadata, Viewport } from "next";
import { Instrument_Sans, Inter, JetBrains_Mono } from "next/font/google";
import { env } from "@/lib/env";
import "./globals.css";

const display = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
});

const body = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  metadataBase: new URL(env.APP_URL),
  title: {
    default: "ResearchBridge | Find university research opportunities",
    template: "%s | ResearchBridge",
  },
  description:
    "ResearchBridge connects students with open research opportunities and gives researchers a structured way to find candidates for their projects.",
  applicationName: "ResearchBridge",
  keywords: [
    "university research",
    "undergraduate research",
    "research assistant",
    "McMaster research",
    "research opportunities",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "ResearchBridge",
    title: "ResearchBridge | Find university research opportunities",
    description:
      "One profile, real openings, and applications written for the specific project you want to work on.",
    url: env.APP_URL,
  },
  twitter: {
    card: "summary_large_image",
    title: "ResearchBridge",
    description: "Find research that is actually looking for you.",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#1d4436",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
