import { spawn } from "child_process";
import { createHash } from "crypto";
import { tmpdir } from "os";
import { promises as fs, createReadStream } from "fs";
import path from "path";

import { and, desc, eq } from "drizzle-orm";
import { BlobSASPermissions } from "@azure/storage-blob";

import dbClient from "@/configs/db";
import blobServiceClient from "@/configs/fs";
import schema from "@/db/schema";
import variables from "@/configs/env";
import logger from "@/configs/logger";
import { ApiError } from "@/shared/types";

/**
 * Database backup service.
 *
 * Each backup:
 *   1. inserts a `system_backups` row in RUNNING state so the UI can show
 *      progress;
 *   2. shells out to `pg_dump` with the configured DATABASE_URL — custom
 *      format (`-Fc`), parallelism off, no owner;
 *   3. streams the dump into Azure Blob under the `backups` container with
 *      a path-by-date object key;
 *   4. updates the row with size, sha256 checksum, and finishedAt.
 *
 * On any error, the row flips to FAILED with an error message so the admin
 * page surfaces the cause.
 */

export type BackupTrigger = "MANUAL" | "SCHEDULED";

export type BackupRecord = {
  id: string;
  trigger: string;
  status: string;
  sizeBytes: number | null;
  blobContainer: string | null;
  blobPath: string | null;
  checksumSha256: string | null;
  startedAt: Date;
  finishedAt: Date | null;
  triggeredBy: string | null;
  errorMessage: string | null;
};

async function ensureBackupContainer(): Promise<void> {
  const client = blobServiceClient.getContainerClient(
    variables.services.backups.container,
  );
  await client.createIfNotExists();
}

function backupBlobKey(): string {
  const now = new Date();
  // YYYY/MM/YYYY-MM-DDTHHMMSSZ-<id-prefix>.dump
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const ymd = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return `${y}/${m}/ypf-${ymd}.dump`;
}

/**
 * Pipe pg_dump's stdout into Azure Blob via an intermediate temp file. We
 * use a temp file (rather than a streaming upload) for two reasons:
 *  1. pg_dump can produce hundreds of MB; chunked upload from a buffered
 *     stream avoids tying up Node heap.
 *  2. We need the file size + sha256 checksum for the audit row, both of
 *     which need a finalized buffer.
 *
 * The temp file is deleted in a finally block whether the upload succeeds
 * or fails.
 */
async function runPgDump(): Promise<{
  filePath: string;
  sizeBytes: number;
  checksum: string;
}> {
  const tmpPath = path.join(
    tmpdir(),
    `ypf-backup-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.dump`,
  );
  const out = await fs.open(tmpPath, "w");

  try {
    await new Promise<void>((resolve, reject) => {
      const proc = spawn(
        variables.services.backups.pgDumpBin,
        [
          variables.database.url,
          "-Fc", // custom format — compresses + supports pg_restore
          "--no-owner",
          "--no-privileges",
        ],
        { stdio: ["ignore", "pipe", "pipe"] },
      );

      let stderr = "";
      proc.stderr.on("data", (d) => {
        stderr += d.toString();
      });
      proc.stdout.on("data", (chunk: Buffer) => {
        out.write(chunk).catch(reject);
      });
      proc.on("error", (err) => reject(err));
      proc.on("close", (code) => {
        if (code !== 0) {
          reject(new Error(`pg_dump exited ${code}: ${stderr.slice(0, 500)}`));
          return;
        }
        resolve();
      });
    });
  } finally {
    await out.close();
  }

  // Compute size + checksum after the dump is fully written.
  const stat = await fs.stat(tmpPath);
  const hash = createHash("sha256");
  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(tmpPath);
    stream.on("data", (c) => hash.update(c));
    stream.on("end", () => resolve());
    stream.on("error", (err) => reject(err));
  });

  return {
    filePath: tmpPath,
    sizeBytes: stat.size,
    checksum: hash.digest("hex"),
  };
}

async function uploadDumpToBlob(localPath: string, blobPath: string) {
  const container = blobServiceClient.getContainerClient(
    variables.services.backups.container,
  );
  const block = container.getBlockBlobClient(blobPath);
  await block.uploadFile(localPath, {
    blobHTTPHeaders: { blobContentType: "application/octet-stream" },
  });
}

/**
 * Kick off a backup. Awaits the full pipeline — completes when the row is
 * either SUCCESS or FAILED. Safe to call from a cron worker (no shared
 * state); not concurrency-safe (running two at once doubles disk + bandwidth
 * for no benefit) so the cron uses a singleton key.
 */
export async function runBackup(input: {
  trigger: BackupTrigger;
  triggeredBy?: string;
}): Promise<BackupRecord> {
  await ensureBackupContainer();

  const [row] = await dbClient.db
    .insert(schema.SystemBackups)
    .values({
      trigger: input.trigger,
      status: "RUNNING",
      triggeredBy: input.triggeredBy,
    })
    .returning();

  let tmpPath: string | null = null;
  try {
    const dump = await runPgDump();
    tmpPath = dump.filePath;

    const blobPath = backupBlobKey();
    await uploadDumpToBlob(dump.filePath, blobPath);

    const [updated] = await dbClient.db
      .update(schema.SystemBackups)
      .set({
        status: "SUCCESS",
        sizeBytes: dump.sizeBytes,
        checksumSha256: dump.checksum,
        blobContainer: variables.services.backups.container,
        blobPath,
        finishedAt: new Date(),
      })
      .where(eq(schema.SystemBackups.id, row.id))
      .returning();

    logger.info(
      {
        id: updated.id,
        sizeBytes: updated.sizeBytes,
        trigger: input.trigger,
      },
      "Backup completed",
    );

    return updated as BackupRecord;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err, backupId: row.id }, "Backup failed");
    await dbClient.db
      .update(schema.SystemBackups)
      .set({
        status: "FAILED",
        finishedAt: new Date(),
        errorMessage: message.slice(0, 1000),
      })
      .where(eq(schema.SystemBackups.id, row.id));

    throw new ApiError(`Backup failed: ${message}`, 500);
  } finally {
    if (tmpPath) {
      fs.unlink(tmpPath).catch(() => {});
    }
  }
}

export async function listBackups(opts: {
  page?: number;
  pageSize?: number;
}): Promise<{
  items: BackupRecord[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const page = opts.page ?? 1;
  const pageSize = Math.min(opts.pageSize ?? 25, 100);
  const offset = (page - 1) * pageSize;

  const [rows, totalRow] = await Promise.all([
    dbClient.db
      .select()
      .from(schema.SystemBackups)
      .orderBy(desc(schema.SystemBackups.startedAt))
      .limit(pageSize)
      .offset(offset),
    dbClient.db
      .execute("SELECT count(*)::int AS n FROM app.system_backups")
      .then(
        (r: unknown) =>
          ((r as unknown as Array<{ n: number }>)[0]?.n as number) ?? 0,
      ),
  ]);

  return {
    items: rows as BackupRecord[],
    total: Number(totalRow),
    page,
    pageSize,
  };
}

export async function generateBackupDownloadUrl(
  id: string,
  expireSeconds: number = 60 * 60,
): Promise<string> {
  const [row] = await dbClient.db
    .select()
    .from(schema.SystemBackups)
    .where(
      and(
        eq(schema.SystemBackups.id, id),
        eq(schema.SystemBackups.status, "SUCCESS"),
      ),
    )
    .limit(1);

  if (!row || !row.blobContainer || !row.blobPath) {
    throw new ApiError("Backup not found or not yet complete", 404);
  }

  const blob = blobServiceClient
    .getContainerClient(row.blobContainer)
    .getBlobClient(row.blobPath);

  return blob.generateSasUrl({
    permissions: BlobSASPermissions.parse("r"),
    expiresOn: new Date(Date.now() + expireSeconds * 1000),
    contentDisposition: `attachment; filename="ypf-backup-${row.id}.dump"`,
  });
}
