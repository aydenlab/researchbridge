import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/permissions";
import { RoleChoice } from "./role-choice";

export const metadata: Metadata = {
  title: "Get started",
  robots: { index: false, follow: false },
};

export default async function OnboardingPage() {
  const user = await requireUser();

  if (user.role === "admin") redirect("/admin");
  if (user.role === "student" && user.onboardingCompletedAt) redirect("/dashboard");
  if (user.role === "researcher" && user.onboardingCompletedAt) redirect("/researcher");
  if (user.role === "student") redirect("/onboarding/student");
  if (user.role === "researcher") redirect("/onboarding/researcher");

  return <RoleChoice email={user.email} institutionName={user.institutionName} />;
}
