/**
 * Notification router.
 *
 * Single entry point for every transactional notification. Each event carries
 * a channel hint in `NOTIFICATION_CHANNELS` below — "email", "sms", or "both".
 * Callers don't pick channels; they call the typed helper and the router
 * fans out. This is the only file you should edit to change channel routing.
 *
 * SMS is supplemental — every "both" event still always sends email. If the
 * recipient has no phone (or Arkesel isn't configured), the SMS leg silently
 * no-ops and email still goes out. Email failures are still rethrown so the
 * caller's existing try/catch behaviour is preserved; SMS failures are never
 * thrown because text messages are best-effort by design.
 */

import logger from "@/configs/logger";
import * as email from "./email";
import * as sms from "./sms";

type Channel = "email" | "sms" | "both";

export const NOTIFICATION_CHANNELS = {
  // Email only — long-form / receipt-style content where SMS adds no value.
  announcement: "email",
  welcome: "email",
  otp: "email",
  donationAck: "email",
  transactionFailure: "email",
  transactionRefund: "email",
  orderPlacement: "email",
  onboardingInvite: "email",
  membershipApplicationAck: "email",

  // Email + SMS — important member-facing events that deserve a fast nudge.
  duesAck: "both",
  duesReminder: "both",
  orderConfirmation: "both",
  membershipAccepted: "both",
  bulkAnnouncement: "both",
  birthday: "both",
} as const satisfies Record<string, Channel>;

export type NotificationEvent = keyof typeof NOTIFICATION_CHANNELS;

function channelFor(event: NotificationEvent): Channel {
  return NOTIFICATION_CHANNELS[event];
}

async function smsBestEffort(
  event: NotificationEvent,
  to: string | null | undefined,
  text: string,
): Promise<void> {
  try {
    await sms.sendSms(to, text, { event });
  } catch (err) {
    logger.warn({ err, event }, "Supplemental SMS send failed (best-effort)");
  }
}

async function bulkSmsBestEffort(
  event: NotificationEvent,
  to: Array<string | null | undefined>,
  text: string,
): Promise<void> {
  try {
    await sms.sendBulkSms(to, text, { event });
  } catch (err) {
    logger.warn({ err, event }, "Supplemental bulk SMS send failed (best-effort)");
  }
}

// ─── Dues ───────────────────────────────────────────────────────────────────

export async function notifyDuesPayment(params: {
  email: string;
  name: string;
  phone?: string | null;
  payment: { id: string; amount: string; currency: string; period: string };
}): Promise<void> {
  const ch = channelFor("duesAck");
  if (ch === "email" || ch === "both") {
    await email.sendDuesPaymentAcknowledgementEmail({
      email: params.email,
      name: params.name,
      payment: params.payment,
    });
  }
  if (ch === "sms" || ch === "both") {
    const text =
      `Hi ${params.name.split(" ")[0]}, we received your YPF dues payment of ` +
      `${params.payment.currency} ${params.payment.amount} for ${params.payment.period}. ` +
      `Ref: ${params.payment.id.slice(0, 8)}. Thank you!`;
    await smsBestEffort("duesAck", params.phone, text);
  }
}

export async function notifyDuesReminder(params: {
  email: string;
  name: string;
  phone?: string | null;
  amountOwed: string;
  currency: string;
  dueDate: string; // already formatted, e.g. "May 30, 2026"
  isOverdue?: boolean;
  payLink?: string;
  // When `email`/`html` are provided we'll use those instead of the default
  // dues-reminder template — kept so the existing /dues-reminders job can
  // reuse its caller-side templating without duplicating it here.
  emailSubject?: string;
  emailHtml?: string;
  emailText?: string;
}): Promise<void> {
  const ch = channelFor("duesReminder");
  if (ch === "email" || ch === "both") {
    if (params.emailSubject && params.emailHtml) {
      await email.sendEmail(
        params.email,
        params.emailSubject,
        params.emailHtml,
        params.emailText,
      );
    } else {
      // Fallback to a generic reminder body. Callers normally provide their
      // own HTML so this path is for ad-hoc usage.
      const subject = params.isOverdue
        ? "Your YPF Africa dues are overdue"
        : "Reminder: YPF Africa dues due soon";
      const body = `Hi ${params.name.split(" ")[0]}, your dues of ${params.currency} ${params.amountOwed} are due ${params.dueDate}.${params.payLink ? ` Pay here: ${params.payLink}` : ""}`;
      await email.sendEmail(params.email, subject, `<p>${body}</p>`, body);
    }
  }
  if (ch === "sms" || ch === "both") {
    const verb = params.isOverdue ? "overdue" : "due";
    const text = `YPF Africa: Your dues (${params.currency} ${params.amountOwed}) are ${verb} ${params.dueDate}.${params.payLink ? " " + params.payLink : ""}`;
    await smsBestEffort("duesReminder", params.phone, text);
  }
}

// ─── Orders ─────────────────────────────────────────────────────────────────

export async function notifyOrderConfirmation(params: {
  email: string;
  name: string;
  phone?: string | null;
  order: { id: string; amount: string; currency: string };
}): Promise<void> {
  const ch = channelFor("orderConfirmation");
  if (ch === "email" || ch === "both") {
    await email.sendOrderConfirmationEmail({
      email: params.email,
      name: params.name,
      order: params.order,
    });
  }
  if (ch === "sms" || ch === "both") {
    const text = `YPF Africa: Order ${params.order.id.slice(0, 8)} confirmed. Total ${params.order.currency} ${params.order.amount}. We'll text you once it ships.`;
    await smsBestEffort("orderConfirmation", params.phone, text);
  }
}

export async function notifyOrderShipped(params: {
  email: string;
  name: string;
  phone?: string | null;
  order: { id: string };
  trackingInfo?: string;
}): Promise<void> {
  // Reuses the order-confirmation channel mapping; if you later want a
  // separate channel preference, add `orderShipped` to NOTIFICATION_CHANNELS.
  const ch = channelFor("orderConfirmation");
  if (ch === "email" || ch === "both") {
    const subject = "Your YPF Africa order is on its way";
    const body = `<p>Hi ${params.name},</p><p>Good news — your order <strong>${params.order.id.slice(0, 8)}</strong> has shipped.${params.trackingInfo ? ` ${params.trackingInfo}` : ""}</p><p>Best regards,<br>The YPF Africa Team</p>`;
    await email.sendEmail(params.email, subject, body);
  }
  if (ch === "sms" || ch === "both") {
    const text = `YPF Africa: Your order ${params.order.id.slice(0, 8)} has shipped.${params.trackingInfo ? " " + params.trackingInfo : ""}`;
    await smsBestEffort("orderConfirmation", params.phone, text);
  }
}

// ─── Membership ─────────────────────────────────────────────────────────────

export async function notifyMembershipAccepted(params: {
  email: string;
  name: string;
  phone?: string | null;
  trackingNumber: string;
}): Promise<void> {
  const ch = channelFor("membershipAccepted");
  if (ch === "email" || ch === "both") {
    await email.sendMembershipApplicationAcceptanceEmail({
      email: params.email,
      name: params.name,
      trackingNumber: params.trackingNumber,
    });
  }
  if (ch === "sms" || ch === "both") {
    const text = `YPF Africa: Congrats ${params.name.split(" ")[0]}! Your membership application has been accepted. Tracking: ${params.trackingNumber}. Check your email for next steps.`;
    await smsBestEffort("membershipAccepted", params.phone, text);
  }
}

// ─── Bulk announcements (broadcast to many) ─────────────────────────────────

/**
 * Broadcast announcement to a list of recipients. The email leg goes through
 * the existing `sendAnnouncementEmail` (which uses BCC for privacy). The SMS
 * leg is a separate bulk send — Arkesel handles the fan-out server-side.
 *
 * The two lists are decoupled because email/phone availability per recipient
 * is independent.
 */
export async function notifyBulkAnnouncement(params: {
  title: string;
  markdown: string; // emails get the rich markdown rendering
  smsText?: string; // SMS body — keep short. Falls back to a trimmed markdown stripped of formatting.
  emailRecipients: string[];
  smsRecipients?: Array<string | null | undefined>;
}): Promise<void> {
  const ch = channelFor("bulkAnnouncement");

  if (ch === "email" || ch === "both") {
    await email.sendAnnouncementEmail(
      params.emailRecipients,
      params.title,
      params.markdown,
    );
  }

  if (ch === "sms" || ch === "both") {
    const recipients = params.smsRecipients ?? [];
    const smsBody =
      params.smsText ??
      `${params.title}\n\n${params.markdown
        .replace(/[#*_>`]/g, "")
        .replace(/\s+/g, " ")
        .trim()}`.slice(0, 459); // 3 SMS segments max
    await bulkSmsBestEffort("bulkAnnouncement", recipients, smsBody);
  }
}

// ─── Birthdays ──────────────────────────────────────────────────────────────

export async function notifyBirthday(params: {
  email: string;
  name: string;
  phone?: string | null;
}): Promise<void> {
  const ch = channelFor("birthday");
  const firstName = params.name.split(" ")[0];

  if (ch === "email" || ch === "both") {
    const subject = `Happy Birthday, ${firstName}!`;
    const html = `<p>Dear ${firstName},</p><p>The YPF Africa team wishes you a wonderful birthday. May this new chapter be full of impact, growth, and celebration.</p><p>With warm wishes,<br>The YPF Africa Team</p>`;
    await email.sendEmail(params.email, subject, html);
  }

  if (ch === "sms" || ch === "both") {
    const text = `YPF Africa: Happy Birthday, ${firstName}! Wishing you an incredible year ahead. 🎉`;
    await smsBestEffort("birthday", params.phone, text);
  }
}

// ─── Re-exports so callers don't have to import both files ──────────────────

export { email, sms };
