/**
 * System service — runtime telemetry + admin controls for super admins.
 *
 * - Health probes hit each external dependency (DB, Redis, SMTP, ImageKit,
 *   Paystack, Azure Blob) with a short timeout and cache the result for 30s
 *   so the dashboard can poll aggressively without hammering vendors.
 * - Metrics are derived live from the pg-boss tables and our own counters.
 * - Settings are stored in `app.system_settings` (key/value JSONB); we expose
 *   a typed getter/setter pair for `maintenance_mode` and feature flags.
 */

import { desc, eq, and, inArray } from "drizzle-orm";
import dbClient from "@/configs/db";
import redisClient from "@/configs/redis";
import emailer from "@/configs/emailer";
import { imagekit } from "@/configs/fs/cdn";
import blobServiceClient, { containerNames } from "@/configs/fs";
import jobDispatcher from "@/configs/jobs/dispatcher";
import variables from "@/configs/env";
import logger from "@/configs/logger";
import schema from "@/db/schema";
import { JobNames } from "@/shared/jobs/types/definitions";

// ─── Health probes ────────────────────────────────────────────────────────

export type ComponentStatus = "online" | "degraded" | "offline" | "disabled";

export interface HealthComponent {
  name: string;
  category:
    | "datastore"
    | "cache"
    | "queue"
    | "email"
    | "storage"
    | "cdn"
    | "payments";
  status: ComponentStatus;
  latencyMs: number | null;
  message?: string;
  required: boolean;
}

export interface SystemHealth {
  overall: ComponentStatus;
  checkedAt: string;
  components: HealthComponent[];
}

const PROBE_TIMEOUT_MS = 3000;
const HEALTH_CACHE_KEY = "system:health:v1";
const HEALTH_CACHE_TTL_SECONDS = 30;

async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} probe timed out after ${ms}ms`)),
      ms,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

async function probe(
  fn: () => Promise<void>,
  label: string,
): Promise<{ status: ComponentStatus; latencyMs: number; message?: string }> {
  const start = Date.now();
  try {
    await withTimeout(fn(), PROBE_TIMEOUT_MS, label);
    return { status: "online", latencyMs: Date.now() - start };
  } catch (err) {
    return {
      status: "offline",
      latencyMs: Date.now() - start,
      message: errorMessage(err),
    };
  }
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object") {
    const obj = err as Record<string, unknown>;
    if (typeof obj.message === "string") return obj.message;
    if (typeof obj.reason === "string") return obj.reason;
    if (typeof obj.help === "string") return obj.help;
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  }
  return String(err);
}

async function probeDatabase(): Promise<HealthComponent> {
  const result = await probe(async () => {
    await dbClient.pool`SELECT 1 AS ok`;
  }, "database");
  return {
    name: "PostgreSQL",
    category: "datastore",
    required: true,
    ...result,
  };
}

async function probeRedis(): Promise<HealthComponent> {
  if (!redisClient._redis) {
    return {
      name: "Redis",
      category: "cache",
      status: "disabled",
      latencyMs: null,
      required: false,
      message: "REDIS_URL not configured — response cache disabled.",
    };
  }
  const result = await probe(async () => {
    const pong = await redisClient._redis!.ping();
    if (pong !== "PONG") throw new Error(`Unexpected reply: ${pong}`);
  }, "redis");
  return {
    name: "Redis",
    category: "cache",
    required: false,
    ...result,
  };
}

async function probeQueue(): Promise<HealthComponent> {
  const result = await probe(async () => {
    // Direct query against the pg-boss schema — confirms (a) pg-boss
    // initialized its schema and (b) Postgres is reachable on the pool we
    // hand pg-boss. Avoids the queue-name validator pg-boss's client API
    // applies (which rejected the "*" wildcard in newer versions).
    await dbClient.pool`SELECT 1 FROM pgboss.version LIMIT 1`;
    // Also sanity-check the dispatcher object so a missing init still shows up.
    void jobDispatcher.client;
  }, "queue");
  return {
    name: "pg-boss queue",
    category: "queue",
    required: true,
    ...result,
  };
}

async function probeSmtp(): Promise<HealthComponent> {
  const result = await probe(async () => {
    await emailer.transporter.verify();
  }, "smtp");
  return {
    name: "SMTP (Nodemailer)",
    category: "email",
    // Non-required: SMTP outage means transactional email queues up but the
    // API itself keeps working. We surface it as degraded, not offline.
    required: false,
    ...result,
  };
}

async function probeImageKit(): Promise<HealthComponent> {
  const result = await probe(async () => {
    // listFiles needs `Media library: Read` permission on the API key. The
    // SDK rejects with an opaque object if the key lacks scope — we wrap
    // the call so the error gets a real message even in that case.
    await new Promise<void>((resolve, reject) => {
      imagekit.listFiles({ limit: 1 }, (err) => {
        if (err) {
          const message =
            err instanceof Error
              ? err.message
              : err && typeof err === "object" && "message" in err
                ? String((err as { message: unknown }).message)
                : "ImageKit listFiles rejected (check key permissions).";
          reject(new Error(message));
          return;
        }
        resolve();
      });
    });
  }, "imagekit");
  return {
    name: "ImageKit CDN",
    category: "cdn",
    required: false,
    ...result,
  };
}

async function probePaystack(): Promise<HealthComponent> {
  if (!variables.services.paystack.secretKey) {
    return {
      name: "Paystack",
      category: "payments",
      status: "disabled",
      latencyMs: null,
      required: false,
      message: "PAYSTACK_SECRET not configured.",
    };
  }
  const result = await probe(async () => {
    // /bank lists banks and only needs a valid secret key — no charge / no
    // state mutation. We don't read the body; status code is what we want.
    const res = await fetch("https://api.paystack.co/bank?perPage=1", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${variables.services.paystack.secretKey}`,
      },
    });
    if (!res.ok) {
      throw new Error(`Paystack returned ${res.status}`);
    }
  }, "paystack");
  return {
    name: "Paystack",
    category: "payments",
    required: false,
    ...result,
  };
}

async function probeAzureBlob(): Promise<HealthComponent> {
  // Azure SDK can be slow on cold start; give it the full probe budget plus
  // a 2s headroom rather than failing every refresh.
  const result = await probe(async () => {
    await blobServiceClient.getProperties({
      abortSignal: AbortSignal.timeout(PROBE_TIMEOUT_MS - 200),
    });
  }, "azure-blob");
  return {
    name: "Azure Blob Storage",
    category: "storage",
    required: false,
    ...result,
  };
}

function rollup(components: HealthComponent[]): ComponentStatus {
  const required = components.filter((c) => c.required);
  if (required.some((c) => c.status === "offline")) return "offline";
  if (components.some((c) => c.status === "offline" && !c.required))
    return "degraded";
  return "online";
}

/**
 * Run every probe in parallel. Returns a cached snapshot when one is fresh,
 * otherwise probes everything and caches the result for 30s.
 */
export async function getSystemHealth(
  options: { fresh?: boolean } = {},
): Promise<SystemHealth> {
  if (!options.fresh) {
    const cached = await redisClient.getCache<SystemHealth>(HEALTH_CACHE_KEY);
    if (cached) return cached;
  }

  const components = await Promise.all([
    probeDatabase(),
    probeRedis(),
    probeQueue(),
    probeSmtp(),
    probeImageKit(),
    probePaystack(),
    probeAzureBlob(),
  ]);

  const snapshot: SystemHealth = {
    overall: rollup(components),
    checkedAt: new Date().toISOString(),
    components,
  };

  // Best-effort cache; never fail health check if Redis is down.
  void redisClient
    .setCache(HEALTH_CACHE_KEY, snapshot, HEALTH_CACHE_TTL_SECONDS)
    .catch(() => undefined);

  return snapshot;
}

/**
 * Run a single integration probe by name. Bypasses the cache.
 */
export async function probeIntegration(
  name: string,
): Promise<HealthComponent | null> {
  switch (name) {
    case "database":
      return probeDatabase();
    case "redis":
      return probeRedis();
    case "queue":
      return probeQueue();
    case "smtp":
      return probeSmtp();
    case "imagekit":
      return probeImageKit();
    case "paystack":
      return probePaystack();
    case "azure-blob":
      return probeAzureBlob();
    default:
      return null;
  }
}

// ─── Metrics ──────────────────────────────────────────────────────────────

export interface SystemMetrics {
  jobs: {
    total: number;
    byState: Record<string, number>;
    perQueue: { queue: string; state: string; count: number }[];
  };
  audit: {
    last24h: number;
    last7d: number;
  };
  uptimeSeconds: number;
  serverVersion: string;
  nodeVersion: string;
  environment: string;
}

/**
 * Aggregate counts from pg-boss's own tables. pg-boss uses the `pgboss` schema
 * by default; we read the `job` table directly to get per-state breakdowns
 * (the client API only returns total queue size, not state distribution).
 */
async function getJobBreakdown(): Promise<SystemMetrics["jobs"]> {
  const rows = (await dbClient.pool`
    SELECT name, state, COUNT(*)::int AS count
    FROM pgboss.job
    GROUP BY name, state
  `) as Array<{ name: string; state: string; count: number }>;

  const byState: Record<string, number> = {};
  let total = 0;
  for (const row of rows) {
    byState[row.state] = (byState[row.state] ?? 0) + row.count;
    total += row.count;
  }

  return {
    total,
    byState,
    perQueue: rows.map((r) => ({
      queue: r.name,
      state: r.state,
      count: r.count,
    })),
  };
}

export async function getSystemMetrics(): Promise<SystemMetrics> {
  // pg-boss may not be initialized in tests; isolate failures so the rest of
  // the metrics still come back.
  let jobs: SystemMetrics["jobs"] = {
    total: 0,
    byState: {},
    perQueue: [],
  };
  try {
    jobs = await getJobBreakdown();
  } catch (err) {
    logger.warn({ err }, "Failed to read pg-boss job breakdown");
  }

  // postgres-js in this project doesn't auto-serialize Date instances, so we
  // pass ISO strings and cast to timestamptz on the server side.
  const now = Date.now();
  const dayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [auditDayRow] = (await dbClient.pool`
    SELECT COUNT(*)::int AS count FROM app.audit_logs
    WHERE created_at >= ${dayAgo}::timestamptz
  `) as Array<{ count: number }>;
  const [auditWeekRow] = (await dbClient.pool`
    SELECT COUNT(*)::int AS count FROM app.audit_logs
    WHERE created_at >= ${weekAgo}::timestamptz
  `) as Array<{ count: number }>;

  return {
    jobs,
    audit: {
      last24h: auditDayRow?.count ?? 0,
      last7d: auditWeekRow?.count ?? 0,
    },
    uptimeSeconds: Math.round(process.uptime()),
    serverVersion: variables.app.version,
    nodeVersion: process.version,
    environment: variables.app.environment,
  };
}

// ─── Failed jobs ──────────────────────────────────────────────────────────

export interface FailedJob {
  id: string;
  name: string;
  state: string;
  retryCount: number;
  retryLimit: number;
  createdOn: string;
  completedOn: string | null;
  output: unknown;
}

export async function listFailedJobs(limit = 20): Promise<FailedJob[]> {
  // pg-boss v10+ uses snake_case columns (retry_count / created_on / etc).
  // Older versions used concatenated names — keep this query in sync with the
  // installed pg-boss version. Verify with `\d pgboss.job` if it 500s.
  const rows = (await dbClient.pool`
    SELECT id::text, name, state,
           retry_count AS "retryCount",
           retry_limit AS "retryLimit",
           created_on AS "createdOn",
           completed_on AS "completedOn",
           output
    FROM pgboss.job
    WHERE state = 'failed'
    ORDER BY completed_on DESC NULLS LAST, created_on DESC
    LIMIT ${limit}
  `) as Array<{
    id: string;
    name: string;
    state: string;
    retryCount: number;
    retryLimit: number;
    createdOn: Date;
    completedOn: Date | null;
    output: unknown;
  }>;

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    state: r.state,
    retryCount: r.retryCount,
    retryLimit: r.retryLimit,
    createdOn: r.createdOn ? r.createdOn.toISOString() : "",
    completedOn: r.completedOn ? r.completedOn.toISOString() : null,
    output: r.output,
  }));
}

const VALID_QUEUE_NAMES = new Set(Object.values(JobNames));

export function isValidQueueName(name: string): boolean {
  return VALID_QUEUE_NAMES.has(name as (typeof JobNames)[keyof typeof JobNames]);
}

// ─── System settings (key/value, JSONB) ──────────────────────────────────

export interface MaintenanceMode {
  enabled: boolean;
  message: string | null;
  since: string | null;
}

const MAINTENANCE_KEY = "maintenance_mode";
const FEATURE_FLAGS_KEY = "feature_flags";
const MAINTENANCE_CACHE_KEY = "system:maintenance:v1";
const MAINTENANCE_CACHE_TTL_SECONDS = 10;

export async function getMaintenanceMode(): Promise<MaintenanceMode> {
  const cached = await redisClient.getCache<MaintenanceMode>(
    MAINTENANCE_CACHE_KEY,
  );
  if (cached) return cached;

  const row = await dbClient.db.query.SystemSettings.findFirst({
    where: eq(schema.SystemSettings.key, MAINTENANCE_KEY),
  });
  const value =
    (row?.value as MaintenanceMode | undefined) ?? {
      enabled: false,
      message: null,
      since: null,
    };

  void redisClient
    .setCache(MAINTENANCE_CACHE_KEY, value, MAINTENANCE_CACHE_TTL_SECONDS)
    .catch(() => undefined);
  return value;
}

export async function setMaintenanceMode(
  next: { enabled: boolean; message?: string | null },
  actorId: string | null,
): Promise<MaintenanceMode> {
  const value: MaintenanceMode = {
    enabled: next.enabled,
    message: next.message ?? null,
    since: next.enabled ? new Date().toISOString() : null,
  };

  await dbClient.db
    .insert(schema.SystemSettings)
    .values({
      key: MAINTENANCE_KEY,
      value,
      description:
        "When enabled, write routes return 503 and public site shows a banner.",
      updatedBy: actorId,
    })
    .onConflictDoUpdate({
      target: schema.SystemSettings.key,
      set: {
        value,
        updatedBy: actorId,
        updatedAt: new Date(),
      },
    });

  await redisClient.delCache(MAINTENANCE_CACHE_KEY);
  return value;
}

export async function getFeatureFlags(): Promise<Record<string, boolean>> {
  const row = await dbClient.db.query.SystemSettings.findFirst({
    where: eq(schema.SystemSettings.key, FEATURE_FLAGS_KEY),
  });
  return (row?.value as Record<string, boolean> | undefined) ?? {};
}

export async function setFeatureFlag(
  key: string,
  enabled: boolean,
  actorId: string | null,
): Promise<Record<string, boolean>> {
  const current = await getFeatureFlags();
  const next = { ...current, [key]: enabled };

  await dbClient.db
    .insert(schema.SystemSettings)
    .values({
      key: FEATURE_FLAGS_KEY,
      value: next,
      description: "Runtime feature flags. Super admin only.",
      updatedBy: actorId,
    })
    .onConflictDoUpdate({
      target: schema.SystemSettings.key,
      set: {
        value: next,
        updatedBy: actorId,
        updatedAt: new Date(),
      },
    });

  return next;
}

// ─── Per-committee maintenance (notice-only) ─────────────────────────────

export interface CommitteeMaintenanceRow {
  committeeId: string;
  committeeName: string;
  committeeAlias: string;
  message: string | null;
  since: string;
  updatedAt: string;
}

/**
 * List committees in maintenance (only those currently flagged), joined with
 * the committee row for name/alias. Returns empty array when none active.
 */
export async function listCommitteeMaintenance(): Promise<
  CommitteeMaintenanceRow[]
> {
  const rows = (await dbClient.pool`
    SELECT cm.committee_id AS "committeeId",
           c.name           AS "committeeName",
           c.alias          AS "committeeAlias",
           cm.message,
           cm.since,
           cm.updated_at    AS "updatedAt"
    FROM app.committee_maintenance cm
    JOIN core.committees c ON c.id = cm.committee_id
    ORDER BY cm.since DESC
  `) as Array<{
    committeeId: string;
    committeeName: string;
    committeeAlias: string;
    message: string | null;
    // postgres-js returns timestamptz as Date when row type is mapped via
    // drizzle, but as a string when accessed through the raw template tag.
    // Normalize.
    since: Date | string;
    updatedAt: Date | string;
  }>;
  return rows.map((r) => ({
    committeeId: r.committeeId,
    committeeName: r.committeeName,
    committeeAlias: r.committeeAlias,
    message: r.message,
    since: toIso(r.since),
    updatedAt: toIso(r.updatedAt),
  }));
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export async function enableCommitteeMaintenance(
  committeeId: string,
  message: string | null,
  actorId: string,
): Promise<void> {
  await dbClient.db
    .insert(schema.CommitteeMaintenance)
    .values({
      committeeId,
      message,
      updatedBy: actorId,
    })
    .onConflictDoUpdate({
      target: schema.CommitteeMaintenance.committeeId,
      set: {
        message,
        updatedBy: actorId,
        updatedAt: new Date(),
      },
    });
}

export async function disableCommitteeMaintenance(
  committeeId: string,
): Promise<void> {
  await dbClient.db
    .delete(schema.CommitteeMaintenance)
    .where(eq(schema.CommitteeMaintenance.committeeId, committeeId));
}

/**
 * Bulk enable or disable across many committees in one transaction.
 */
export async function bulkCommitteeMaintenance(input: {
  committeeIds: string[];
  action: "enable" | "disable";
  message?: string | null;
  actorId: string;
}): Promise<{ affected: number }> {
  if (input.committeeIds.length === 0) return { affected: 0 };

  return dbClient.db.transaction(async (tx) => {
    if (input.action === "disable") {
      const deleted = await tx
        .delete(schema.CommitteeMaintenance)
        .where(
          inArray(schema.CommitteeMaintenance.committeeId, input.committeeIds),
        );
      return { affected: deleted.count ?? input.committeeIds.length };
    }
    // enable
    const values = input.committeeIds.map((id) => ({
      committeeId: id,
      message: input.message ?? null,
      updatedBy: input.actorId,
    }));
    await tx
      .insert(schema.CommitteeMaintenance)
      .values(values)
      .onConflictDoUpdate({
        target: schema.CommitteeMaintenance.committeeId,
        set: {
          message: input.message ?? null,
          updatedBy: input.actorId,
          updatedAt: new Date(),
        },
      });
    return { affected: input.committeeIds.length };
  });
}

export async function deleteFeatureFlag(
  key: string,
  actorId: string | null,
): Promise<Record<string, boolean>> {
  const current = await getFeatureFlags();
  if (!(key in current)) return current;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { [key]: _removed, ...rest } = current;

  await dbClient.db
    .insert(schema.SystemSettings)
    .values({
      key: FEATURE_FLAGS_KEY,
      value: rest,
      description: "Runtime feature flags. Super admin only.",
      updatedBy: actorId,
    })
    .onConflictDoUpdate({
      target: schema.SystemSettings.key,
      set: {
        value: rest,
        updatedBy: actorId,
        updatedAt: new Date(),
      },
    });

  return rest;
}

// ─── Audit log ────────────────────────────────────────────────────────────

export interface AuditEntry {
  id: string;
  actorEmail: string | null;
  action: string;
  target: string | null;
  metadata: unknown;
  sourceIp: string | null;
  statusCode: number | null;
  createdAt: string;
}

export interface RecordAuditInput {
  actorId: string | null;
  actorEmail: string | null;
  action: string;
  target?: string | null;
  metadata?: unknown;
  sourceIp?: string | null;
  userAgent?: string | null;
  statusCode?: number | null;
}

export async function recordAudit(entry: RecordAuditInput): Promise<void> {
  try {
    await dbClient.db.insert(schema.AuditLogs).values({
      actorId: entry.actorId,
      actorEmail: entry.actorEmail,
      action: entry.action,
      target: entry.target ?? null,
      metadata: entry.metadata ?? null,
      sourceIp: entry.sourceIp ?? null,
      userAgent: entry.userAgent ?? null,
      statusCode: entry.statusCode ?? null,
    });
  } catch (err) {
    // Never fail the request because the audit insert failed; log loudly.
    logger.error({ err, action: entry.action }, "Failed to write audit log");
  }
}

export async function listAuditLog(
  options: { limit?: number; actorId?: string; action?: string } = {},
): Promise<AuditEntry[]> {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);

  const filters = [];
  if (options.actorId)
    filters.push(eq(schema.AuditLogs.actorId, options.actorId));
  if (options.action) filters.push(eq(schema.AuditLogs.action, options.action));

  const rows = await dbClient.db
    .select({
      id: schema.AuditLogs.id,
      actorEmail: schema.AuditLogs.actorEmail,
      action: schema.AuditLogs.action,
      target: schema.AuditLogs.target,
      metadata: schema.AuditLogs.metadata,
      sourceIp: schema.AuditLogs.sourceIp,
      statusCode: schema.AuditLogs.statusCode,
      createdAt: schema.AuditLogs.createdAt,
    })
    .from(schema.AuditLogs)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(schema.AuditLogs.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    actorEmail: r.actorEmail,
    action: r.action,
    target: r.target,
    metadata: r.metadata,
    sourceIp: r.sourceIp,
    statusCode: r.statusCode,
    createdAt: r.createdAt.toISOString(),
  }));
}

// ─── Service surface metadata ────────────────────────────────────────────

export interface ServiceSurface {
  apiVersion: string;
  environment: string;
  nodeVersion: string;
  startedAt: string;
  allowedOrigins: string[];
  containers: string[];
}

const startedAt = new Date().toISOString();

export function getServiceSurface(): ServiceSurface {
  return {
    apiVersion: variables.app.version,
    environment: variables.app.environment,
    nodeVersion: process.version,
    startedAt,
    allowedOrigins: variables.security.allowedOrigins,
    containers: Object.values(containerNames),
  };
}

// ─── Recently-changed audit_logs since N hours (for SystemHealthSummary) ──

export async function countRecentErrors(hours = 24): Promise<number> {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  const [row] = (await dbClient.pool`
    SELECT COUNT(*)::int AS count
    FROM pgboss.job
    WHERE state = 'failed' AND completed_on >= ${since}::timestamptz
  `) as Array<{ count: number }>;
  return row?.count ?? 0;
}

