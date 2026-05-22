import { ApiResponse } from "@/shared/types";
import { AuthenticatedUser } from "@/shared/types";
import * as systemService from "@/shared/services/systemService";
import jobDispatcher from "@/configs/jobs/dispatcher";
import { ApiError } from "@/shared/types";

export async function health(
  fresh: boolean,
): Promise<ApiResponse<systemService.SystemHealth>> {
  const data = await systemService.getSystemHealth({ fresh });
  return { success: true, data };
}

export async function metrics(): Promise<
  ApiResponse<systemService.SystemMetrics>
> {
  const data = await systemService.getSystemMetrics();
  return { success: true, data };
}

export async function probeOne(
  name: string,
): Promise<ApiResponse<systemService.HealthComponent>> {
  const data = await systemService.probeIntegration(name);
  if (!data) {
    throw new ApiError(`Unknown integration: ${name}`, 400);
  }
  return { success: true, data };
}

export async function listFailedJobs(
  limit: number,
): Promise<ApiResponse<systemService.FailedJob[]>> {
  const data = await systemService.listFailedJobs(limit);
  return { success: true, data };
}

export async function retryJob(
  queue: string,
  jobId: string,
): Promise<ApiResponse<{ jobId: string }>> {
  if (!systemService.isValidQueueName(queue)) {
    throw new ApiError(`Invalid queue name: ${queue}`, 400);
  }
  await jobDispatcher.client.resume(queue, jobId);
  return {
    success: true,
    data: { jobId },
    message: "Job retry initiated",
  };
}

export async function cancelJob(
  queue: string,
  jobId: string,
): Promise<ApiResponse<{ jobId: string }>> {
  if (!systemService.isValidQueueName(queue)) {
    throw new ApiError(`Invalid queue name: ${queue}`, 400);
  }
  await jobDispatcher.client.cancel(queue, jobId);
  return {
    success: true,
    data: { jobId },
    message: "Job cancelled",
  };
}

export async function getMaintenance(): Promise<
  ApiResponse<systemService.MaintenanceMode>
> {
  const data = await systemService.getMaintenanceMode();
  return { success: true, data };
}

export async function setMaintenance(
  user: AuthenticatedUser,
  body: { enabled: boolean; message?: string | null },
): Promise<ApiResponse<systemService.MaintenanceMode>> {
  const data = await systemService.setMaintenanceMode(
    body,
    user.constituentId,
  );
  return {
    success: true,
    data,
    message: body.enabled
      ? "Maintenance mode enabled — write routes will return 503"
      : "Maintenance mode disabled",
  };
}

export async function getFlags(): Promise<
  ApiResponse<Record<string, boolean>>
> {
  const data = await systemService.getFeatureFlags();
  return { success: true, data };
}

export async function setFlag(
  user: AuthenticatedUser,
  key: string,
  enabled: boolean,
): Promise<ApiResponse<Record<string, boolean>>> {
  const data = await systemService.setFeatureFlag(
    key,
    enabled,
    user.constituentId,
  );
  return { success: true, data, message: `Flag '${key}' set to ${enabled}` };
}

export async function deleteFlag(
  user: AuthenticatedUser,
  key: string,
): Promise<ApiResponse<Record<string, boolean>>> {
  const data = await systemService.deleteFeatureFlag(
    key,
    user.constituentId,
  );
  return { success: true, data, message: `Flag '${key}' removed` };
}

export async function listCommitteeMaintenance(): Promise<
  ApiResponse<systemService.CommitteeMaintenanceRow[]>
> {
  const data = await systemService.listCommitteeMaintenance();
  return { success: true, data };
}

export async function setCommitteeMaintenance(
  user: AuthenticatedUser,
  committeeId: string,
  body: { message?: string | null },
): Promise<ApiResponse<{ committeeId: string }>> {
  await systemService.enableCommitteeMaintenance(
    committeeId,
    body.message ?? null,
    user.constituentId,
  );
  return {
    success: true,
    data: { committeeId },
    message: "Committee maintenance enabled",
  };
}

export async function clearCommitteeMaintenance(
  committeeId: string,
): Promise<ApiResponse<{ committeeId: string }>> {
  await systemService.disableCommitteeMaintenance(committeeId);
  return {
    success: true,
    data: { committeeId },
    message: "Committee maintenance cleared",
  };
}

export async function bulkCommitteeMaintenance(
  user: AuthenticatedUser,
  body: {
    committeeIds: string[];
    action: "enable" | "disable";
    message?: string | null;
  },
): Promise<ApiResponse<{ affected: number }>> {
  const data = await systemService.bulkCommitteeMaintenance({
    ...body,
    actorId: user.constituentId,
  });
  return {
    success: true,
    data,
    message: `Bulk ${body.action}: ${data.affected} committee(s)`,
  };
}

export async function listAudit(
  query: { limit?: number; actorId?: string; action?: string },
): Promise<ApiResponse<systemService.AuditEntry[]>> {
  const data = await systemService.listAuditLog(query);
  return { success: true, data };
}

export async function surface(): Promise<
  ApiResponse<systemService.ServiceSurface>
> {
  const data = systemService.getServiceSurface();
  return { success: true, data };
}

import * as backupService from "@/shared/services/backupService";

export async function listBackups(
  query: { page?: number; pageSize?: number },
): Promise<ApiResponse<Awaited<ReturnType<typeof backupService.listBackups>>>> {
  const data = await backupService.listBackups(query);
  return { success: true, data };
}

export async function triggerBackup(
  constituentId: string,
): Promise<ApiResponse<{ id: string; status: string }>> {
  // Kick off in the background so the admin gets a fast 202. The row flips
  // to SUCCESS / FAILED on its own; the UI polls the list endpoint.
  const seed = await backupService.runBackup({
    trigger: "MANUAL",
    triggeredBy: constituentId,
  }).catch(() => null);
  // runBackup is awaited here for the small-data case (faster than two
  // round-trips) but rethrowing into the 202 swallows the error — the row
  // already carries the FAILED status. The handler returns whichever final
  // state we landed in.
  return {
    success: true,
    data: { id: seed?.id ?? "", status: seed?.status ?? "FAILED" },
    message: "Backup triggered",
  };
}

export async function getBackupDownloadUrl(
  id: string,
): Promise<ApiResponse<{ url: string; expiresInSeconds: number }>> {
  const expireSeconds = 60 * 60;
  const url = await backupService.generateBackupDownloadUrl(id, expireSeconds);
  return { success: true, data: { url, expiresInSeconds: expireSeconds } };
}
