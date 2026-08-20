import { env } from "@/lib/env";
import { sendEmail } from "./index";

const SIGNATURE = "ResearchBridge\nhello@myresearchbridge.com";

export async function sendVerificationCode(to: string, code: string) {
  return sendEmail({
    to,
    subject: "Your ResearchBridge verification code",
    text: [
      `Your ResearchBridge verification code is ${code}.`,
      "",
      "The code expires in 10 minutes and can be used once.",
      "If you did not request this code, you can ignore this message.",
      "",
      SIGNATURE,
    ].join("\n"),
  });
}

export async function sendApplicationReceived(to: string, projectTitle: string, researcherName: string) {
  return sendEmail({
    to,
    subject: `Application received: ${projectTitle}`,
    text: [
      `Your application to "${projectTitle}" has been sent to ${researcherName} for review.`,
      "",
      `You can track its status at ${env.APP_URL}/applications.`,
      "",
      SIGNATURE,
    ].join("\n"),
  });
}

export async function sendNewApplicantNotice(to: string, projectTitle: string, count: number) {
  return sendEmail({
    to,
    subject: `New application for ${projectTitle}`,
    text: [
      `A student has applied to "${projectTitle}".`,
      `That position now has ${count} submitted ${count === 1 ? "application" : "applications"}.`,
      "",
      `Review applicants at ${env.APP_URL}/researcher/opportunities.`,
      "",
      SIGNATURE,
    ].join("\n"),
  });
}

export async function sendStatusChange(to: string, projectTitle: string, statusLabel: string) {
  return sendEmail({
    to,
    subject: `Update on your application: ${projectTitle}`,
    text: [
      `Your application to "${projectTitle}" is now marked ${statusLabel}.`,
      "",
      `See details at ${env.APP_URL}/applications.`,
      "",
      SIGNATURE,
    ].join("\n"),
  });
}

export async function sendResearcherContact(to: string, projectTitle: string, researcherName: string, researcherEmail: string, message: string) {
  return sendEmail({
    to,
    replyTo: researcherEmail,
    subject: `${researcherName} would like to speak with you about ${projectTitle}`,
    text: [
      `${researcherName} has asked to move forward with your application to "${projectTitle}".`,
      "",
      message,
      "",
      `You can reply to this email to reach ${researcherEmail}.`,
      "",
      SIGNATURE,
    ].join("\n"),
  });
}

export async function sendResearcherApproved(to: string, name: string) {
  return sendEmail({
    to,
    subject: "Your ResearchBridge researcher account is approved",
    text: [
      `${name}, your researcher account has been approved.`,
      "",
      `You can post a research opportunity at ${env.APP_URL}/researcher/opportunities/new.`,
      "",
      SIGNATURE,
    ].join("\n"),
  });
}

export async function sendPilotInvite(to: string, firstName: string, token: string) {
  return sendEmail({
    to,
    subject: "Your ResearchBridge pilot invitation",
    text: [
      `${firstName}, the ResearchBridge pilot at Example University is open to you.`,
      "",
      `Create your account here: ${env.APP_URL}/signin?invite=${token}`,
      "",
      SIGNATURE,
    ].join("\n"),
  });
}
