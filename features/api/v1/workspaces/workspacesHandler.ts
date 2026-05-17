import { ApiResponse } from "@/shared/types";
import * as workspaceService from "@/shared/services/workspaceService";
import type { AuthenticatedUser } from "@/shared/types";

export async function getWorkspaceReport({
  alias,
  month,
  user,
}: {
  alias: string;
  month?: string;
  user: AuthenticatedUser;
}): Promise<ApiResponse<workspaceService.WorkspaceReport>> {
  const data = await workspaceService.getWorkspaceReport({ alias, month, user });
  return {
    success: true,
    message: "Workspace report fetched successfully",
    data,
  };
}

export async function submitWorkspaceDocument({
  alias,
  user,
  month,
  kind,
  body,
  documentName,
  documentUrl,
}: {
  alias: string;
  user: AuthenticatedUser;
  month?: string;
  kind: workspaceService.WorkspaceSubmissionKind;
  body: string;
  documentName?: string;
  documentUrl?: string;
}): Promise<ApiResponse<workspaceService.WorkspaceSubmission>> {
  const data = await workspaceService.submitWorkspaceMonthlyDocument({
    alias,
    user,
    month,
    kind,
    body,
    documentName,
    documentUrl,
  });
  return {
    success: true,
    message: "Workspace submission saved successfully",
    data,
  };
}

export async function getAllWorkspaceReports({
  month,
  user,
}: {
  month?: string;
  user: AuthenticatedUser;
}): Promise<ApiResponse<workspaceService.WorkspaceCommitteeReportSummary[]>> {
  const data = await workspaceService.getAllWorkspaceReports({ month, user });
  return {
    success: true,
    message: "Committee workspace reports fetched successfully",
    data,
  };
}

export async function getWorkspaceNotes({
  committeeId,
  entityType,
  entityId,
  user,
}: {
  committeeId: string;
  entityType?: workspaceService.WorkspaceNoteEntityType;
  entityId?: string;
  user: AuthenticatedUser;
}): Promise<ApiResponse<workspaceService.WorkspaceNote[]>> {
  const data = await workspaceService.getWorkspaceNotes({
    committeeId,
    entityType,
    entityId,
    user,
  });
  return {
    success: true,
    message: "Workspace notes fetched successfully",
    data,
  };
}

export async function createWorkspaceNote({
  committeeId,
  entityType,
  entityId,
  body,
  user,
}: {
  committeeId: string;
  entityType: workspaceService.WorkspaceNoteEntityType;
  entityId?: string;
  body: string;
  user: AuthenticatedUser;
}): Promise<ApiResponse<{ id: string }>> {
  const id = await workspaceService.createWorkspaceNote({
    committeeId,
    entityType,
    entityId,
    body,
    user,
  });
  return {
    success: true,
    message: "Workspace note created successfully",
    data: { id },
  };
}

export async function deleteWorkspaceNote({
  noteId,
  user,
}: {
  noteId: string;
  user: AuthenticatedUser;
}): Promise<ApiResponse<null>> {
  await workspaceService.deleteWorkspaceNote({ noteId, user });
  return {
    success: true,
    message: "Workspace note deleted successfully",
    data: null,
  };
}
