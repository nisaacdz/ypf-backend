import dbClient from "@/configs/db";
import redisClient from "@/configs/redis";
import variables from "@/configs/env";
import logger from "@/configs/logger";

/**
 * Deep-readiness checks exposed at GET /healthz.
 *
 * Each check is wrapped in `withTimeout` so a slow vendor can't make the
 * whole probe hang past a reasonable threshold (uptime monitors get
 * impatient). Failures are caught + reported as `ok: false` rather than
 * thrown — every dep contributes its own row, the consumer aggregates.
 *
 * Auth is intentionally none: the response carries no secret data and a
 * 503 here is what tells your monitor to page someone.
 */

type CheckResult = {
  name: string;
  ok: boolean;
  latencyMs: number;
  error?: string;
};

const HEALTHZ_DEP_TIMEOUT_MS = 4000;

async function withTimeout<T>(p: Promise<T>): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new Error(`Timed out after ${HEALTHZ_DEP_TIMEOUT_MS}ms`)),
        HEALTHZ_DEP_TIMEOUT_MS,
      ),
    ),
  ]);
}

async function timed(
  name: string,
  fn: () => Promise<unknown>,
): Promise<CheckResult> {
  const start = Date.now();
  try {
    await withTimeout(fn());
    return { name, ok: true, latencyMs: Date.now() - start };
  } catch (err) {
    return {
      name,
      ok: false,
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function pingDb() {
  // SELECT 1 against the live pool — confirms the connection is alive and
  // the credentials are still valid.
  await dbClient.db.execute("select 1 as ok");
}

async function pingRedis() {
  const r = (redisClient as unknown as { _redis?: { ping: () => Promise<string> } })
    ._redis;
  if (!r) {
    // Redis is optional; treat absent client as "not configured" rather
    // than a failure. Returning here keeps the overall probe green.
    return;
  }
  await r.ping();
}

async function pingPaystack() {
  // /transaction/totals is a cheap auth-required endpoint; we don't need
  // its response, just a 200 status. If the key is wrong/expired we'll
  // see 401 here before customers see it on checkout.
  const res = await fetch("https://api.paystack.co/transaction/totals", {
    headers: {
      Authorization: `Bearer ${variables.services.paystack.secretKey}`,
    },
  });
  if (!res.ok) {
    throw new Error(`Paystack returned ${res.status}`);
  }
}

async function pingArkesel() {
  const apiKey = variables.services.arkesel.apiKey;
  if (!apiKey) {
    // Not configured — skip (matches Redis behaviour).
    return;
  }
  const url = `${variables.services.arkesel.baseUrl.replace(/\/+$/, "")}/clients/balance-details`;
  const res = await fetch(url, {
    headers: { "api-key": apiKey },
  });
  if (!res.ok) {
    throw new Error(`Arkesel returned ${res.status}`);
  }
}

export async function runReadinessChecks(): Promise<{
  ok: boolean;
  timestamp: string;
  checks: CheckResult[];
}> {
  const checks = await Promise.all([
    timed("db", pingDb),
    timed("redis", pingRedis),
    timed("paystack", pingPaystack),
    timed("arkesel", pingArkesel),
  ]);

  const ok = checks.every((c) => c.ok);
  if (!ok) {
    logger.warn({ checks }, "/healthz reports degraded dependencies");
  }

  return {
    ok,
    timestamp: new Date().toISOString(),
    checks,
  };
}
