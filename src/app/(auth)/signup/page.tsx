import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { SignInForm } from "../signin/sign-in-form";

export const metadata: Metadata = {
  title: "Sign up",
  description: "Create a free ResearchBridge student account with your university email.",
  alternates: { canonical: "/signup" },
};

export default async function SignUpPage() {
  const user = await getSessionUser();
  if (user) {
    if (!user.role) redirect("/onboarding");
    if (!user.onboardingCompletedAt && user.role !== "admin") {
      redirect(user.role === "researcher" ? "/onboarding/researcher" : "/onboarding/student");
    }
    redirect(user.role === "admin" ? "/admin" : user.role === "researcher" ? "/researcher" : "/dashboard");
  }

  return <SignInForm mode="signup" />;
}
