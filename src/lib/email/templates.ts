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

export async function sendReferenceRequest(input: {
  to: string;
  refereeName: string | null;
  studentName: string;
  projectTitle: string;
  relationship: string | null;
  url: string;
}) {
  const greeting = input.refereeName ? `Hello ${input.refereeName},` : "Hello,";
  return sendEmail({
    to: input.to,
    subject: `${input.studentName} listed you as a reference`,
    text: [
      greeting,
      "",
      `${input.studentName} has applied to "${input.projectTitle}" on ResearchBridge and listed you as a reference${
        input.relationship ? ` (${input.relationship})` : ""
      }.`,
      "",
      "Confirming takes one click and says only that you are willing to be named. You are not writing a letter and you are not rating anyone.",
      "",
      input.url,
      "",
      "If you do not know this person, decline on that page and we will record it. The link works once and then expires.",
      "",
      SIGNATURE,
    ].join("\n"),
  });
}

export async function sendReferenceResolved(input: {
  to: string;
  refereeLabel: string;
  projectTitle: string;
  approved: boolean;
}) {
  return sendEmail({
    to: input.to,
    subject: `${input.refereeLabel} ${input.approved ? "confirmed" : "declined"} your reference request`,
    text: [
      `${input.refereeLabel} has ${
        input.approved ? "confirmed they are willing to act as your reference" : "declined to act as your reference"
      } for "${input.projectTitle}".`,
      "",
      `You can see the current state of your references at ${env.APP_URL}/applications.`,
      "",
      SIGNATURE,
    ].join("\n"),
  });
}

export async function sendNewFollowerNotice(to: string, followerName: string) {
  return sendEmail({
    to,
    subject: `${followerName} is now following you on ResearchBridge`,
    text: [
      `${followerName} started following you on ResearchBridge.`,
      "",
      `See who follows you at ${env.APP_URL}/connections.`,
      "",
      SIGNATURE,
    ].join("\n"),
  });
}
