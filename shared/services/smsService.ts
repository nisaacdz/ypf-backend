import { and, count, desc, eq, gte, inArray, sql } from "drizzle-orm";
import dbClient from "@/configs/db";
import schema from "@/db/schema";
import logger from "@/configs/logger";
import { ApiError } from "@/shared/types";
import { getArkeselBalance, sendBulkSms } from "@/shared/utils/sms";
import { resolveAudience } from "./targetResolver";
import { TargetingFilter } from "@/shared/types/targeting";

export type SmsHistoryRow = {
  id: string;
  batchId: string;
  event: string;
  recipient: string;
  constituent?: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
  message: string;
  segmentCount: number;
  status: string;
  createdAt: Date;
};

export type SmsStats = {
  totals: { sent: number; failed: number; skipped: number };
  segments: { today: number; week: number; month: number; total: number };
  byEvent: Array<{ event: string; sent: number; segments: number }>;
  recentBatches: Array<{
    batchId: string;
    event: string;
    sentAt: Date;
    recipients: number;
    sent: number;
    failed: number;
    segments: number;
    triggeredBy?: string | null;
  }>;
};

const ALLOWED_AUDIENCES = ["all", "members", "chapter", "committee", "custom"] as const;
export type AudienceKind = (typeof ALLOWED_AUDIENCES)[number];

type ManualSendInput = {
  message: string;
  audience: AudienceKind;
  chapterIds?: string[];
  committeeIds?: string[];
  customPhones?: string[];
  triggeredBy?: string;
};

type ResolvedAudience = {
  phones: string[];
  recipientConstituentIds: Record<string, string>;
};

async function resolveSmsAudience(
  input: ManualSendInput,
): Promise<ResolvedAudience> {
  const { audience, chapterIds, committeeIds, customPhones } = input;

  if (audience === "custom") {
    const phones = (customPhones ?? []).filter(
      (p): p is string => typeof p === "string" && p.trim().length > 0,
    );
    if (phones.length === 0) {
      throw new ApiError("No phone numbers provided", 400);
    }
    return { phones, recipientConstituentIds: {} };
  }

  let filter: TargetingFilter;
  if (audience === "all") {
    filter = { status: "ACTIVE" };
  } else if (audience === "members") {
    filter = { constituentTypes: ["MEMBER"], status: "ACTIVE" };
  } else if (audience === "chapter") {
    if (!chapterIds?.length) {
      throw new ApiError("Pick at least one chapter", 400);
    }
    filter = {
      constituentTypes: ["MEMBER"],
      chapterIds,
      status: "ACTIVE",
    };
  } else if (audience === "committee") {
    if (!committeeIds?.length) {
      throw new ApiError("Pick at least one committee", 400);
    }
    filter = {
      constituentTypes: ["MEMBER"],
      committeeIds,
      status: "ACTIVE",
    };
  } else {
    throw new ApiError(`Unsupported audience: ${audience}`, 400);
  }

  const constituentIds = await resolveAudience(filter);
  if (constituentIds.length === 0) {
    return { phones: [], recipientConstituentIds: {} };
  }

  const rows = await dbClient.db
    .select({
      id: schema.Constituents.id,
      phone: schema.Constituents.phone,
      whatsapp: schema.Constituents.whatsapp,
    })
    .from(schema.Constituents)
    .where(inArray(schema.Constituents.id, constituentIds));

  const phones: string[] = [];
  const map: Record<string, string> = {};
  for (const r of rows) {
    const phone = r.phone ?? r.whatsapp;
    if (!phone) continue;
    phones.push(phone);
    map[phone] = r.id;
  }
  return { phones, recipientConstituentIds: map };
}

export async function manualBroadcast(input: ManualSendInput): Promise<{
  batchId: string;
  sent: number;
  failed: number;
  skipped: number;
  recipients: number;
}> {
  if (!input.message.trim()) {
    throw new ApiError("Message body is required", 400);
  }
  if (input.message.length > 1500) {
    throw new ApiError("Message is too long (max 1500 characters)", 400);
  }

  const { phones, recipientConstituentIds } = await resolveSmsAudience(input);
  if (phones.length === 0) {
    throw new ApiError("Audience has no reachable phone numbers", 400);
  }

  const result = await sendBulkSms(phones, input.message, {
    event: "manualBroadcast",
    triggeredBy: input.triggeredBy,
    recipientConstituentIds,
  });

  logger.info(
    {
      batchId: result.batchId,
      recipients: phones.length,
      sent: result.sent,
      failed: result.failed,
      audience: input.audience,
    },
    "Manual SMS broadcast dispatched",
  );

  return {
    batchId: result.batchId,
    sent: result.sent,
    failed: result.failed,
    skipped: result.skipped,
    recipients: phones.length,
  };
}

export async function fetchSmsHistory(query: {
  page?: number;
  pageSize?: number;
  event?: string;
  status?: string;
  batchId?: string;
  search?: string;
}): Promise<{ items: SmsHistoryRow[]; total: number; page: number; pageSize: number }> {
  const page = query.page ?? 1;
  const pageSize = Math.min(query.pageSize ?? 25, 100);
  const offset = (page - 1) * pageSize;

  const conds = [];
  if (query.event) conds.push(eq(schema.SmsMessages.event, query.event));
  if (query.status) conds.push(eq(schema.SmsMessages.status, query.status));
  if (query.batchId) conds.push(eq(schema.SmsMessages.batchId, query.batchId));
  if (query.search) {
    // Search across recipient phone, message body, and constituent name —
    // the three fields a support person types into the search box. ILIKE
    // is fine at our scale; if we ever cross 1M rows, switch to pg_trgm.
    const needle = `%${query.search}%`;
    conds.push(
      sql`(${schema.SmsMessages.recipient} ILIKE ${needle}
        OR ${schema.SmsMessages.message} ILIKE ${needle}
        OR ${schema.Constituents.firstName} ILIKE ${needle}
        OR ${schema.Constituents.lastName} ILIKE ${needle})`,
    );
  }
  const whereClause = conds.length ? and(...conds) : undefined;

  const [rows, totalRow] = await Promise.all([
    dbClient.db
      .select({
        id: schema.SmsMessages.id,
        batchId: schema.SmsMessages.batchId,
        event: schema.SmsMessages.event,
        recipient: schema.SmsMessages.recipient,
        message: schema.SmsMessages.message,
        segmentCount: schema.SmsMessages.segmentCount,
        status: schema.SmsMessages.status,
        createdAt: schema.SmsMessages.createdAt,
        constituentId: schema.SmsMessages.constituentId,
        firstName: schema.Constituents.firstName,
        lastName: schema.Constituents.lastName,
      })
      .from(schema.SmsMessages)
      .leftJoin(
        schema.Constituents,
        eq(schema.SmsMessages.constituentId, schema.Constituents.id),
      )
      .where(whereClause)
      .orderBy(desc(schema.SmsMessages.createdAt))
      .limit(pageSize)
      .offset(offset),
    dbClient.db
      .select({ n: count() })
      .from(schema.SmsMessages)
      .where(whereClause)
      .then((r) => r[0]?.n ?? 0),
  ]);

  const items: SmsHistoryRow[] = rows.map((r) => ({
    id: r.id,
    batchId: r.batchId,
    event: r.event,
    recipient: r.recipient,
    constituent: r.constituentId
      ? {
          id: r.constituentId,
          firstName: r.firstName ?? "",
          lastName: r.lastName ?? "",
        }
      : null,
    message: r.message,
    segmentCount: r.segmentCount,
    status: r.status,
    createdAt: r.createdAt,
  }));

  return { items, total: Number(totalRow), page, pageSize };
}

export async function fetchSmsStats(): Promise<SmsStats> {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - 7);
  const monthStart = new Date(now);
  monthStart.setDate(now.getDate() - 30);

  // Roll up totals by status.
  const totalsByStatus = await dbClient.db
    .select({
      status: schema.SmsMessages.status,
      n: count(),
    })
    .from(schema.SmsMessages)
    .groupBy(schema.SmsMessages.status);

  const totals = { sent: 0, failed: 0, skipped: 0 };
  for (const row of totalsByStatus) {
    if (row.status === "SENT") totals.sent = Number(row.n);
    else if (row.status === "FAILED") totals.failed = Number(row.n);
    else if (row.status === "SKIPPED") totals.skipped = Number(row.n);
  }

  // Segment usage windows (SENT only — failed/skipped never consume credit).
  const segmentSql = sql<number>`COALESCE(SUM(${schema.SmsMessages.segmentCount}), 0)::int`;
  const [segTotal, segMonth, segWeek, segToday] = await Promise.all([
    dbClient.db
      .select({ s: segmentSql })
      .from(schema.SmsMessages)
      .where(eq(schema.SmsMessages.status, "SENT"))
      .then((r) => Number(r[0]?.s ?? 0)),
    dbClient.db
      .select({ s: segmentSql })
      .from(schema.SmsMessages)
      .where(
        and(
          eq(schema.SmsMessages.status, "SENT"),
          gte(schema.SmsMessages.createdAt, monthStart),
        ),
      )
      .then((r) => Number(r[0]?.s ?? 0)),
    dbClient.db
      .select({ s: segmentSql })
      .from(schema.SmsMessages)
      .where(
        and(
          eq(schema.SmsMessages.status, "SENT"),
          gte(schema.SmsMessages.createdAt, weekStart),
        ),
      )
      .then((r) => Number(r[0]?.s ?? 0)),
    dbClient.db
      .select({ s: segmentSql })
      .from(schema.SmsMessages)
      .where(
        and(
          eq(schema.SmsMessages.status, "SENT"),
          gte(schema.SmsMessages.createdAt, todayStart),
        ),
      )
      .then((r) => Number(r[0]?.s ?? 0)),
  ]);

  // Per-event breakdown (SENT only).
  const byEventRows = await dbClient.db
    .select({
      event: schema.SmsMessages.event,
      sent: count(),
      segments: segmentSql,
    })
    .from(schema.SmsMessages)
    .where(eq(schema.SmsMessages.status, "SENT"))
    .groupBy(schema.SmsMessages.event)
    .orderBy(desc(count()));

  // Recent batches (batch_id roll-up).
  const recentBatchRows = await dbClient.db
    .select({
      batchId: schema.SmsMessages.batchId,
      event: sql<string>`MAX(${schema.SmsMessages.event})`,
      sentAt: sql<Date>`MAX(${schema.SmsMessages.createdAt})`,
      recipients: count(),
      sent: sql<number>`SUM(CASE WHEN ${schema.SmsMessages.status} = 'SENT' THEN 1 ELSE 0 END)::int`,
      failed: sql<number>`SUM(CASE WHEN ${schema.SmsMessages.status} = 'FAILED' THEN 1 ELSE 0 END)::int`,
      segments: sql<number>`SUM(CASE WHEN ${schema.SmsMessages.status} = 'SENT' THEN ${schema.SmsMessages.segmentCount} ELSE 0 END)::int`,
      triggeredBy: sql<string | null>`MAX(${schema.SmsMessages.triggeredBy}::text)`,
    })
    .from(schema.SmsMessages)
    .groupBy(schema.SmsMessages.batchId)
    .orderBy(desc(sql`MAX(${schema.SmsMessages.createdAt})`))
    .limit(20);

  return {
    totals,
    segments: {
      today: segToday,
      week: segWeek,
      month: segMonth,
      total: segTotal,
    },
    byEvent: byEventRows.map((r) => ({
      event: r.event,
      sent: Number(r.sent),
      segments: Number(r.segments),
    })),
    recentBatches: recentBatchRows.map((r) => ({
      batchId: r.batchId,
      event: r.event,
      sentAt: r.sentAt,
      recipients: Number(r.recipients),
      sent: Number(r.sent),
      failed: Number(r.failed),
      segments: Number(r.segments),
      triggeredBy: r.triggeredBy,
    })),
  };
}

export async function fetchBalance() {
  return getArkeselBalance();
}
