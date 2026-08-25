import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to ResearchBridge with your email address.",
  robots: { index: false, follow: false },
};

export default async function SignInPage() {
  const user = await getSessionUser();
  if (user) {
    if (!user.role) redirect("/onboarding");
    if (!user.onboardingCompletedAt && user.role !== "admin") {
      redirect(user.role === "researcher" ? "/onboarding/researcher" : "/onboarding/student");
    }
    redirect(user.role === "admin" ? "/admin" : user.role === "researcher" ? "/researcher" : "/dashboard");
  }

  return <SignInForm />;
}
