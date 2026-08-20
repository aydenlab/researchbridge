import { log } from "@/lib/log";
import { resolveProvider } from "./providers";
import type { EmailMessage, EmailResult } from "./types";

export async function sendEmail(message: EmailMessage): Promise<EmailResult> {
  const provider = resolveProvider();
  const result = await provider.send(message);
  if (!result.ok) {
    log.error("email_delivery_failed", { provider: provider.name, to: message.to, subject: message.subject, reason: result.error });
  }
  return result;
}

export * from "./templates";
export type { EmailMessage, EmailResult };
