import variables from "@/configs/env";
import logger from "@/configs/logger";
import dbClient from "@/configs/db";
import schema from "@/db/schema";
import { v4 as uuidv4 } from "uuid";

/**
 * Arkesel SMS client.
 *
 * Docs: https://developers.arkesel.com/#tag/SMS-V2
 *
 * Endpoints used:
 *   POST /api/v2/sms/send         — single recipient
 *   POST /api/v2/sms/send         — bulk (same endpoint, array of recipients)
 *   GET  /api/v2/clients/balance  — account balance (for diagnostics)
 *
 * When `ARKESEL_API_KEY` is not configured every send is a no-op that logs at
 * INFO. That keeps local development and the test suite working without real
 * credentials and prevents the boot from failing.
 *
 * Every send (including no-op skips and Arkesel failures) is also persisted
 * to `app.sms_messages` so the admin /sms page can render history + analytics.
 * Log writes are best-effort — they never fail the send.
 */

const ARKESEL_MAX_RECIPIENTS_PER_REQUEST = 1000;

/**
 * GSM-7 SMS segment math. Most ASCII messages fit 160 chars per segment; once
 * you cross 160 it switches to multi-part (153 chars per segment due to UDH).
 * UCS-2 (any non-GSM-7 char like emoji) drops to 70 (or 67 multi-part). We do
 * a simplified GSM-7-only calc since Arkesel charges roughly per segment and
 * we don't ship emojis from server-side templates.
 */
function calculateSegments(message: string): number {
  const len = message.length;
  if (len === 0) return 0;
  if (len <= 160) return 1;
  return Math.ceil(len / 153);
}

export type SmsSendContext = {
  /**
   * Tag identifying the originating flow. Use the keys from
   * `notify.NOTIFICATION_CHANNELS` for transactional sends (e.g.
   * "duesReminder") and "manualBroadcast" for admin-composed sends.
   */
  event: string;
  /** Constituent id of the admin who triggered the send (manual sends only). */
  triggeredBy?: string;
  /**
   * Optional mapping from phone → constituent id. When provided the log row
   * is linked to the constituent so the history table can show their name.
   */
  recipientConstituentIds?: Record<string, string>;
  /**
   * Override the auto-generated batch id. Pass when many calls (e.g. a
   * Promise.all over per-recipient notifications) should appear as one batch.
   */
  batchId?: string;
};

/**
 * Normalise a phone number into Arkesel's required `+233…` style E.164 form.
 *
 * Accepts:
 *   - `+233244123456`     → `+233244123456`
 *   - `233244123456`      → `+233244123456`
 *   - `0244123456`        → `+233244123456` (assumes Ghana for leading 0)
 *   - `244123456`         → `+233244123456` (assumes Ghana when no country code)
 *
 * Returns null when the value is empty / clearly not a phone number. The
 * caller is responsible for filtering nulls — we do not throw because partial
 * delivery (some recipients OK, some skipped) is better than blowing up a
 * bulk send.
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.replace(/[\s()-]/g, "");
  if (!trimmed) return null;

  if (trimmed.startsWith("+")) {
    return /^\+\d{8,15}$/.test(trimmed) ? trimmed : null;
  }
  if (trimmed.startsWith("00")) {
    const e164 = `+${trimmed.slice(2)}`;
    return /^\+\d{8,15}$/.test(e164) ? e164 : null;
  }
  if (trimmed.startsWith("0")) {
    // Local Ghanaian form: 0XXXXXXXXX → +233XXXXXXXXX
    return /^\d{9,10}$/.test(trimmed) ? `+233${trimmed.slice(1)}` : null;
  }
  if (/^233\d{8,9}$/.test(trimmed)) {
    return `+${trimmed}`;
  }
  // Any remaining all-digit string of plausible length is treated as a
  // Ghanaian subscriber number without the leading zero.
  if (/^\d{9}$/.test(trimmed)) {
    return `+233${trimmed}`;
  }
  return null;
}

type SmsResult = {
  batchId: string;
  sent: number;
  skipped: number;
  failed: number;
};

async function logSends(
  ctx: SmsSendContext,
  batchId: string,
  recipients: string[],
  message: string,
  status: "SENT" | "FAILED" | "SKIPPED",
  providerResponse?: unknown,
): Promise<void> {
  if (recipients.length === 0) return;
  try {
    const segmentCount = calculateSegments(message);
    const messageLength = message.length;
    await dbClient.db.insert(schema.SmsMessages).values(
      recipients.map((r) => ({
        batchId,
        event: ctx.event,
        recipient: r,
        constituentId: ctx.recipientConstituentIds?.[r],
        message,
        messageLength,
        segmentCount,
        status,
        provider: "arkesel",
        providerResponse:
          providerResponse === undefined
            ? null
            : (providerResponse as Record<string, unknown>),
        triggeredBy: ctx.triggeredBy,
      })),
    );
  } catch (err) {
    logger.warn(
      { err, event: ctx.event, batchId },
      "Failed to persist SMS log rows (best-effort)",
    );
  }
}

async function postArkesel(
  ctx: SmsSendContext,
  body: {
    recipients: string[];
    message: string;
    sandbox?: boolean;
  },
): Promise<SmsResult> {
  const apiKey = variables.services.arkesel.apiKey;
  const senderId = variables.services.arkesel.senderId;
  const batchId = ctx.batchId ?? uuidv4();

  if (!apiKey) {
    logger.info(
      { recipientCount: body.recipients.length, preview: body.message.slice(0, 60) },
      "Arkesel API key not configured — SMS skipped (no-op)",
    );
    await logSends(ctx, batchId, body.recipients, body.message, "SKIPPED", {
      reason: "no_api_key",
    });
    return { batchId, sent: 0, skipped: body.recipients.length, failed: 0 };
  }

  if (body.recipients.length === 0) {
    return { batchId, sent: 0, skipped: 0, failed: 0 };
  }

  const url = `${variables.services.arkesel.baseUrl.replace(/\/+$/, "")}/sms/send`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify({
        sender: senderId,
        message: body.message,
        recipients: body.recipients,
        // Sandbox accepts the request and returns success without actually
        // delivering. We default OFF and require an explicit env opt-in so
        // dev/staging exercises real delivery — silent no-delivery is the
        // single most common "the SMS was marked SENT but I never got it"
        // failure mode, so we surface the choice instead of inferring it.
        sandbox: body.sandbox ?? variables.services.arkesel.sandbox,
      }),
    });

    const json = (await res.json().catch(() => ({}))) as {
      status?: string;
      message?: string;
      data?: unknown;
    };

    if (!res.ok || (json.status && json.status !== "success")) {
      logger.error(
        { status: res.status, body: json, recipientCount: body.recipients.length },
        "Arkesel SMS send failed",
      );
      await logSends(
        ctx,
        batchId,
        body.recipients,
        body.message,
        "FAILED",
        json,
      );
      return {
        batchId,
        sent: 0,
        skipped: 0,
        failed: body.recipients.length,
      };
    }

    await logSends(ctx, batchId, body.recipients, body.message, "SENT", json);
    return {
      batchId,
      sent: body.recipients.length,
      skipped: 0,
      failed: 0,
    };
  } catch (err) {
    logger.error(
      { err, recipientCount: body.recipients.length },
      "Arkesel SMS request threw",
    );
    await logSends(ctx, batchId, body.recipients, body.message, "FAILED", {
      threw: err instanceof Error ? err.message : String(err),
    });
    return {
      batchId,
      sent: 0,
      skipped: 0,
      failed: body.recipients.length,
    };
  }
}

/**
 * Send a single SMS. Returns true on success, false on any failure (including
 * a no-op skip when credentials aren't configured). Never throws — SMS is
 * supplemental to email, so a failure here should not abort the calling flow.
 */
export async function sendSms(
  to: string | null | undefined,
  message: string,
  ctx: SmsSendContext = { event: "unspecified" },
): Promise<boolean> {
  const recipient = normalizePhone(to);
  if (!recipient) {
    logger.debug({ to, event: ctx.event }, "SMS skipped — no valid phone number");
    return false;
  }
  const { sent } = await postArkesel(ctx, {
    recipients: [recipient],
    message,
  });
  return sent > 0;
}

/**
 * Send the same SMS to many recipients. Numbers are normalised and de-duped;
 * invalid entries are silently dropped. Splits into chunks of 1000 to respect
 * Arkesel's per-request recipient cap.
 */
export async function sendBulkSms(
  recipients: Array<string | null | undefined>,
  message: string,
  ctx: SmsSendContext = { event: "unspecified" },
): Promise<SmsResult> {
  const cleaned = Array.from(
    new Set(
      recipients
        .map(normalizePhone)
        .filter((r): r is string => typeof r === "string"),
    ),
  );

  const batchId = ctx.batchId ?? uuidv4();
  const ctxWithBatch: SmsSendContext = { ...ctx, batchId };

  if (cleaned.length === 0) {
    return { batchId, sent: 0, skipped: 0, failed: 0 };
  }

  const totals: SmsResult = { batchId, sent: 0, skipped: 0, failed: 0 };
  for (let i = 0; i < cleaned.length; i += ARKESEL_MAX_RECIPIENTS_PER_REQUEST) {
    const slice = cleaned.slice(i, i + ARKESEL_MAX_RECIPIENTS_PER_REQUEST);
    const r = await postArkesel(ctxWithBatch, {
      recipients: slice,
      message,
    });
    totals.sent += r.sent;
    totals.skipped += r.skipped;
    totals.failed += r.failed;
  }
  return totals;
}

/**
 * Best-effort SMS balance lookup. Used by the admin diagnostics page; returns
 * null if Arkesel is not configured or the call fails.
 */
export async function getArkeselBalance(): Promise<{
  balance: number;
  currency: string;
  configured: boolean;
  sandbox: boolean;
  senderId: string;
} | null> {
  const apiKey = variables.services.arkesel.apiKey;
  const sandbox = variables.services.arkesel.sandbox;
  const senderId = variables.services.arkesel.senderId;
  if (!apiKey)
    return {
      balance: 0,
      currency: "GHS",
      configured: false,
      sandbox,
      senderId,
    };
  const url = `${variables.services.arkesel.baseUrl.replace(/\/+$/, "")}/clients/balance-details`;
  try {
    const res = await fetch(url, { headers: { "api-key": apiKey } });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      data?: {
        balance?: number;
        sms_balance?: number;
        main_balance?: { balance?: number };
        currency?: string;
      };
    };
    const balance =
      json?.data?.balance ??
      json?.data?.sms_balance ??
      json?.data?.main_balance?.balance ??
      0;
    const currency = json?.data?.currency ?? "GHS";
    return {
      balance: Number(balance),
      currency,
      configured: true,
      sandbox,
      senderId,
    };
  } catch {
    return null;
  }
}
