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

export async function updateWorkspaceNote({
  noteId,
  body,
  user,
}: {
  noteId: string;
  body: string;
  user: AuthenticatedUser;
}): Promise<ApiResponse<{ id: string }>> {
  const id = await workspaceService.updateWorkspaceNote({
    noteId,
    body,
    user,
  });
  return {
    success: true,
    message: "Workspace note updated successfully",
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

export async function getWorkspaceAttachments({
  committeeId,
  noteId,
  user,
}: {
  committeeId: string;
  noteId: string;
  user: AuthenticatedUser;
}): Promise<ApiResponse<workspaceService.WorkspaceAttachment[]>> {
  const data = await workspaceService.getWorkspaceAttachments({
    committeeId,
    noteId,
    user,
  });
  return {
    success: true,
    message: "Workspace attachments fetched successfully",
    data,
  };
}

export async function createWorkspaceAttachment({
  committeeId,
  noteId,
  label,
  file,
  user,
}: {
  committeeId: string;
  noteId: string;
  label?: string;
  file: Express.Multer.File;
  user: AuthenticatedUser;
}): Promise<ApiResponse<workspaceService.WorkspaceAttachment>> {
  const data = await workspaceService.createWorkspaceAttachment({
    committeeId,
    noteId,
    label,
    file,
    user,
  });
  return {
    success: true,
    message: "Workspace attachment uploaded successfully",
    data,
  };
}

export async function deleteWorkspaceAttachment({
  attachmentId,
  user,
}: {
  attachmentId: string;
  user: AuthenticatedUser;
}): Promise<ApiResponse<null>> {
  await workspaceService.deleteWorkspaceAttachment({ attachmentId, user });
  return {
    success: true,
    message: "Workspace attachment deleted successfully",
    data: null,
  };
}

export async function getFinanceDonations(input: {
  user: AuthenticatedUser;
  page: number;
  pageSize: number;
  month?: string;
}): Promise<ApiResponse<workspaceService.PaginatedWorkspaceResult<workspaceService.FinanceDonation>>> {
  const data = await workspaceService.getFinanceDonations(input);
  return {
    success: true,
    message: "Finance donations fetched successfully",
    data,
  };
}

export async function getFinanceExpenditures(input: {
  user: AuthenticatedUser;
  page: number;
  pageSize: number;
  month?: string;
}): Promise<ApiResponse<workspaceService.PaginatedWorkspaceResult<workspaceService.FinanceExpenditure>>> {
  const data = await workspaceService.getFinanceExpenditures(input);
  return {
    success: true,
    message: "Finance expenditures fetched successfully",
    data,
  };
}

export async function createFinanceExpenditure(input: {
  user: AuthenticatedUser;
  amount: number;
  currency: string;
  description: string;
  category?: string;
  timestamp?: string;
}): Promise<ApiResponse<workspaceService.FinanceExpenditure>> {
  const data = await workspaceService.createFinanceExpenditure(input);
  return {
    success: true,
    message: "Finance expenditure recorded successfully",
    data,
  };
}

export async function getFinanceBudgets(input: {
  user: AuthenticatedUser;
  page: number;
  pageSize: number;
  month?: string;
}): Promise<ApiResponse<workspaceService.PaginatedWorkspaceResult<workspaceService.FinanceBudgetRequest>>> {
  const data = await workspaceService.getFinanceBudgets(input);
  return {
    success: true,
    message: "Finance budgets fetched successfully",
    data,
  };
}

export async function createFinanceBudget(input: {
  user: AuthenticatedUser;
  title: string;
  month: string;
  currency: string;
  rationale: string;
  lines: { description: string; category?: string; amount: number; notes?: string }[];
}): Promise<ApiResponse<workspaceService.FinanceBudgetRequest>> {
  const data = await workspaceService.createFinanceBudget(input);
  return {
    success: true,
    message: "Finance budget submitted for review",
    data,
  };
}

export async function reviewFinanceBudget(input: {
  user: AuthenticatedUser;
  budgetId: string;
  status: "APPROVED" | "REJECTED";
  reviewNote?: string;
}): Promise<ApiResponse<workspaceService.FinanceBudgetRequest>> {
  const data = await workspaceService.reviewFinanceBudget(input);
  return {
    success: true,
    message: "Finance budget reviewed successfully",
    data,
  };
}
