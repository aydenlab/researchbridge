import { env } from "@/lib/env";
import { log } from "@/lib/log";
import type { EmailMessage, EmailProvider, EmailResult } from "./types";

const consoleProvider: EmailProvider = {
  name: "console",
  async send(message: EmailMessage): Promise<EmailResult> {
    log.info("email_console_delivery", { to: message.to, subject: message.subject });
    console.log(`\n--- email to ${message.to} ---\n${message.subject}\n\n${message.text}\n---\n`);
    return { ok: true, id: "console" };
  },
};

const resendProvider: EmailProvider = {
  name: "resend",
  async send(message: EmailMessage): Promise<EmailResult> {
    if (!env.EMAIL_API_KEY) return { ok: false, error: "missing_api_key" };
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.EMAIL_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: env.EMAIL_FROM,
          to: [message.to],
          subject: message.subject,
          text: message.text,
          html: message.html,
          reply_to: message.replyTo,
        }),
      });
      if (!response.ok) {
        return { ok: false, error: `provider_status_${response.status}` };
      }
      const body = (await response.json()) as { id?: string };
      return { ok: true, id: body.id };
    } catch {
      return { ok: false, error: "provider_unreachable" };
    }
  },
};

const smtpProvider: EmailProvider = {
  name: "smtp",
  async send(): Promise<EmailResult> {
    return { ok: false, error: "smtp_provider_not_configured" };
  },
};

export function resolveProvider(): EmailProvider {
  switch (env.EMAIL_PROVIDER) {
    case "resend":
      return resendProvider;
    case "smtp":
      return smtpProvider;
    default:
      return consoleProvider;
  }
}
