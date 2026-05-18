import {
  and,
  count,
  desc,
  eq,
  gte,
  isNull,
  lt,
  or,
  sql,
} from "drizzle-orm";

import dbClient from "@/configs/db";
import schema from "@/db/schema";
import { ApiError, type AuthenticatedUser } from "@/shared/types";
import {
  canAccessCommitteeLive,
  canManageCommitteeLive,
  FINANCE_ALIAS,
  getCommitteeByAlias,
  GRAPHICS_ALIAS,
  HR_ALIAS,
  isSystemAdminLive,
  MEDIA_ALIAS,
  WELFARE_ALIAS,
} from "./workspaceAccessService";
import {
  deleteDocumentFile,
  generateSignedDocumentDownloadUrl,
  generateSignedDocumentPreviewUrl,
  storeDocumentFile,
} from "@/shared/utils/files";

export type WorkspaceSubmissionKind = "PLAN" | "REPORT";
export type WorkspaceNoteEntityType = "program" | "event" | "workspace";

export type WorkspaceSubmission = {
  id: string;
  kind: WorkspaceSubmissionKind;
  body: string;
  documentName?: string;
  documentUrl?: string;
  submittedBy: string;
  submittedAt: Date;
  updatedAt: Date;
};

export type WorkspaceReportMetric = {
  label: string;
  value: string | number;
  hint: string;
};

export type WorkspaceReportListItem = {
  id: string;
  title: string;
  meta: string;
  badge: string;
  attendeeCount?: number;
  attendedCount?: number;
};

export type WorkspaceReport = {
  committee: {
    id: string;
    name: string;
    alias: string;
  };
  month: {
    label: string;
    value: string;
    planDueLabel: string;
    reportDueLabel: string;
  };
  access: {
    canSubmit: boolean;
    label: "Admin submission" | "Chair submission" | "Member view";
  };
  submissions: {
    plan: WorkspaceSubmission | null;
    report: WorkspaceSubmission | null;
  };
  metrics: WorkspaceReportMetric[];
  attendance: WorkspaceReportListItem[];
  outcomes: WorkspaceReportListItem[];
  generatedItems: WorkspaceReportListItem[];
};

export type WorkspaceCommitteeReportSummary = {
  committee: {
    id: string;
    name: string;
    alias: string;
  };
  month: ReturnType<typeof getMonthMeta>;
  submissions: {
    plan: WorkspaceSubmission | null;
    report: WorkspaceSubmission | null;
  };
};

export type WorkspaceNote = {
  id: string;
  committeeId: string;
  entityType: WorkspaceNoteEntityType;
  entityId?: string;
  body: string;
  authorId: string;
  authorName: string;
  createdAt: Date;
};

export type WorkspaceAttachment = {
  id: string;
  committeeId: string;
  noteId: string;
  documentId: string;
  label?: string;
  originalFileName: string;
  type: string;
  size: number;
  previewUrl: string;
  downloadUrl: string;
  uploadedBy: string;
  uploadedByName: string;
  uploadedAt: Date;
  canDelete: boolean;
};

export type FinanceDonation = {
  id: string;
  amount: string;
  currency: string;
  status: string;
  donorName: string;
  donorEmail?: string | null;
  note?: string | null;
  createdAt: Date;
};

export type FinanceExpenditure = {
  id: string;
  amount: string;
  currency: string;
  description: string;
  category?: string | null;
  timestamp: Date;
};

export type FinanceBudgetRequest = {
  id: string;
  title: string;
  month: Date;
  currency: string;
  totalAmount: string;
  rationale: string;
  lines: {
    description: string;
    category?: string;
    amount: string;
    notes?: string;
  }[];
  status: "SUBMITTED" | "APPROVED" | "REJECTED";
  submittedBy: string;
  submittedByName: string;
  submittedAt: Date;
  reviewedBy?: string | null;
  reviewedAt?: Date | null;
  reviewNote?: string | null;
};

export type PaginatedWorkspaceResult<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
};

export async function getWorkspaceReport({
  alias,
  month,
  user,
}: {
  alias: string;
  month?: string;
  user: AuthenticatedUser;
}): Promise<WorkspaceReport> {
  const committee = await requireWorkspaceAccess(alias, user);
  const monthStart = normalizeMonth(month);
  const nextMonthStart = new Date(
    Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 1),
  );

  const submissions = await getMonthlySubmissions(committee.id, monthStart);
  const access = await getAccessDescriptor(user, committee.id);

  if (alias === "programs_records") {
    const reportData = await getProgramsRecordsReportData(
      monthStart,
      nextMonthStart,
    );
    return {
      committee,
      month: getMonthMeta(monthStart),
      access,
      submissions,
      ...reportData,
    };
  }

  if (alias === "finance") {
    const reportData = await getFinanceReportData(monthStart, nextMonthStart);
    return {
      committee,
      month: getMonthMeta(monthStart),
      access,
      submissions,
      ...reportData,
    };
  }

  if (alias === HR_ALIAS) {
    const reportData = await getHrReportData(monthStart, nextMonthStart);
    return {
      committee,
      month: getMonthMeta(monthStart),
      access,
      submissions,
      ...reportData,
    };
  }

  if (alias === WELFARE_ALIAS) {
    const reportData = await getWelfareReportData(
      committee.id,
      monthStart,
      nextMonthStart,
    );
    return {
      committee,
      month: getMonthMeta(monthStart),
      access,
      submissions,
      ...reportData,
    };
  }

  if (alias === MEDIA_ALIAS) {
    const reportData = await getMediaReportData(
      committee.id,
      monthStart,
      nextMonthStart,
    );
    return {
      committee,
      month: getMonthMeta(monthStart),
      access,
      submissions,
      ...reportData,
    };
  }

  if (alias === GRAPHICS_ALIAS) {
    const reportData = await getGraphicsReportData(
      committee.id,
      monthStart,
      nextMonthStart,
    );
    return {
      committee,
      month: getMonthMeta(monthStart),
      access,
      submissions,
      ...reportData,
    };
  }

  const [{ total }] = await dbClient.db
    .select({ total: count() })
    .from(schema.CommitteeMemberships)
    .where(
      and(
        eq(schema.CommitteeMemberships.committeeId, committee.id),
        isNull(schema.CommitteeMemberships.endedAt),
      ),
    );

  return {
    committee,
    month: getMonthMeta(monthStart),
    access,
    submissions,
    metrics: [
      { label: "Committee members", value: total, hint: "Active people in this workspace" },
      {
        label: "Monthly plan",
        value: submissions.plan ? "Submitted" : getPlanStatus(monthStart),
        hint: "Due at the beginning of the month",
      },
      {
        label: "Monthly report",
        value: submissions.report ? "Submitted" : getReportStatus(monthStart),
        hint: "Due at the end of the month",
      },
      { label: "Generated report", value: "Ready", hint: "Auto-generated from workspace activity" },
    ],
    attendance: [],
    outcomes: [],
    generatedItems: [
      {
        id: "people",
        title: `${total} active committee member${total === 1 ? "" : "s"}`,
        meta: "People tab source",
        badge: "people",
      },
      {
        id: "monthly",
        title: `${getMonthMeta(monthStart).label} plan and report cycle`,
        meta: "Beginning-of-month plan and end-of-month report required",
        badge: "monthly",
      },
    ],
  };
}

export async function submitWorkspaceMonthlyDocument({
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
  kind: WorkspaceSubmissionKind;
  body: string;
  documentName?: string;
  documentUrl?: string;
}): Promise<WorkspaceSubmission> {
  const committee = await requireWorkspaceManageAccess(alias, user);
  const monthStart = normalizeMonth(month);
  const now = new Date();

  const [row] = await dbClient.db
    .insert(schema.WorkspaceMonthlySubmissions)
    .values({
      committeeId: committee.id,
      month: monthStart,
      kind,
      body,
      documentName,
      documentUrl,
      submittedBy: user.constituentId,
      submittedAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [
        schema.WorkspaceMonthlySubmissions.committeeId,
        schema.WorkspaceMonthlySubmissions.month,
        schema.WorkspaceMonthlySubmissions.kind,
      ],
      set: {
        body,
        documentName,
        documentUrl,
        submittedBy: user.constituentId,
        submittedAt: now,
        updatedAt: now,
      },
    })
    .returning();

  return toSubmission(row);
}

export async function getAllWorkspaceReports({
  month,
  user,
}: {
  month?: string;
  user: AuthenticatedUser;
}): Promise<WorkspaceCommitteeReportSummary[]> {
  if (!(await isSystemAdminLive(user))) {
    throw new ApiError("Only admins can view all committee workspace reports", 403);
  }

  const monthStart = normalizeMonth(month);
  const committees = await dbClient.db
    .select({
      id: schema.Committees.id,
      name: schema.Committees.name,
      alias: schema.Committees.alias,
    })
    .from(schema.Committees)
    .where(isNull(schema.Committees.archivedAt))
    .orderBy(schema.Committees.name);

  const rows = await dbClient.db
    .select()
    .from(schema.WorkspaceMonthlySubmissions)
    .where(eq(schema.WorkspaceMonthlySubmissions.month, monthStart));

  const submissionsByCommittee = new Map<
    string,
    { plan: WorkspaceSubmission | null; report: WorkspaceSubmission | null }
  >();

  for (const row of rows) {
    const entry = submissionsByCommittee.get(row.committeeId) ?? {
      plan: null,
      report: null,
    };
    if (row.kind === "PLAN") entry.plan = toSubmission(row);
    if (row.kind === "REPORT") entry.report = toSubmission(row);
    submissionsByCommittee.set(row.committeeId, entry);
  }

  return committees.map((committee) => ({
    committee,
    month: getMonthMeta(monthStart),
    submissions: submissionsByCommittee.get(committee.id) ?? {
      plan: null,
      report: null,
    },
  }));
}

export async function getWorkspaceNotes({
  committeeId,
  entityType,
  entityId,
  user,
}: {
  committeeId: string;
  entityType?: WorkspaceNoteEntityType;
  entityId?: string;
  user: AuthenticatedUser;
}): Promise<WorkspaceNote[]> {
  if (!(await canAccessCommitteeLive(user, committeeId))) {
    throw new ApiError("You don't have permission to access this workspace", 403);
  }

  const conditions = [
    eq(schema.WorkspaceNotes.committeeId, committeeId),
    isNull(schema.WorkspaceNotes.deletedAt),
  ];
  if (entityType) conditions.push(eq(schema.WorkspaceNotes.entityType, entityType));
  if (entityId) conditions.push(eq(schema.WorkspaceNotes.entityId, entityId));

  const rows = await dbClient.db
    .select({
      id: schema.WorkspaceNotes.id,
      committeeId: schema.WorkspaceNotes.committeeId,
      entityType: schema.WorkspaceNotes.entityType,
      entityId: schema.WorkspaceNotes.entityId,
      body: schema.WorkspaceNotes.body,
      authorId: schema.WorkspaceNotes.authorId,
      authorFirstName: schema.Constituents.firstName,
      authorLastName: schema.Constituents.lastName,
      createdAt: schema.WorkspaceNotes.createdAt,
    })
    .from(schema.WorkspaceNotes)
    .innerJoin(
      schema.Constituents,
      eq(schema.WorkspaceNotes.authorId, schema.Constituents.id),
    )
    .where(and(...conditions))
    .orderBy(desc(schema.WorkspaceNotes.createdAt));

  return rows.map((row) => ({
    id: row.id,
    committeeId: row.committeeId,
    entityType: row.entityType,
    entityId: row.entityId ?? undefined,
    body: row.body,
    authorId: row.authorId,
    authorName: `${row.authorFirstName} ${row.authorLastName}`.trim(),
    createdAt: row.createdAt,
  }));
}

export async function createWorkspaceNote({
  committeeId,
  entityType,
  entityId,
  body,
  user,
}: {
  committeeId: string;
  entityType: WorkspaceNoteEntityType;
  entityId?: string;
  body: string;
  user: AuthenticatedUser;
}): Promise<string> {
  if (!(await canAccessCommitteeLive(user, committeeId))) {
    throw new ApiError("You don't have permission to access this workspace", 403);
  }

  const [note] = await dbClient.db
    .insert(schema.WorkspaceNotes)
    .values({
      committeeId,
      entityType,
      entityId,
      body,
      authorId: user.constituentId,
    })
    .returning({ id: schema.WorkspaceNotes.id });

  return note.id;
}

export async function updateWorkspaceNote({
  noteId,
  body,
  user,
}: {
  noteId: string;
  body: string;
  user: AuthenticatedUser;
}): Promise<string> {
  const note = await dbClient.db.query.WorkspaceNotes.findFirst({
    where: eq(schema.WorkspaceNotes.id, noteId),
  });
  if (!note || note.deletedAt) throw new ApiError("Workspace note not found", 404);

  const canManage = await canManageCommitteeLive(user, note.committeeId);
  if (!canManage && note.authorId !== user.constituentId) {
    throw new ApiError("Only the note author, a workspace chair, or an admin can update this note", 403);
  }

  await dbClient.db
    .update(schema.WorkspaceNotes)
    .set({ body })
    .where(eq(schema.WorkspaceNotes.id, noteId));

  return noteId;
}

export async function deleteWorkspaceNote({
  noteId,
  user,
}: {
  noteId: string;
  user: AuthenticatedUser;
}): Promise<void> {
  const note = await dbClient.db.query.WorkspaceNotes.findFirst({
    where: eq(schema.WorkspaceNotes.id, noteId),
  });
  if (!note || note.deletedAt) throw new ApiError("Workspace note not found", 404);

  if (!(await isSystemAdminLive(user)) && note.authorId !== user.constituentId) {
    throw new ApiError("Only the note author or an admin can delete this note", 403);
  }

  await dbClient.db
    .update(schema.WorkspaceNotes)
    .set({ deletedAt: new Date() })
    .where(eq(schema.WorkspaceNotes.id, noteId));
}

export async function getWorkspaceAttachments({
  committeeId,
  noteId,
  user,
}: {
  committeeId: string;
  noteId: string;
  user: AuthenticatedUser;
}): Promise<WorkspaceAttachment[]> {
  if (!(await canAccessCommitteeLive(user, committeeId))) {
    throw new ApiError("You don't have permission to access this workspace", 403);
  }

  await requireLiveWorkspaceNote(committeeId, noteId);

  const [isAdmin, canManage] = await Promise.all([
    isSystemAdminLive(user),
    canManageCommitteeLive(user, committeeId),
  ]);

  const rows = await dbClient.db
    .select({
      id: schema.WorkspaceAttachments.id,
      committeeId: schema.WorkspaceAttachments.committeeId,
      noteId: schema.WorkspaceAttachments.noteId,
      documentId: schema.WorkspaceAttachments.documentId,
      label: schema.WorkspaceAttachments.label,
      originalFileName: schema.WorkspaceAttachments.originalFileName,
      uploadedBy: schema.WorkspaceAttachments.uploadedBy,
      uploadedFirstName: schema.Constituents.firstName,
      uploadedLastName: schema.Constituents.lastName,
      uploadedAt: schema.WorkspaceAttachments.uploadedAt,
      type: schema.Documents.type,
      size: schema.Documents.size,
      externalId: schema.Documents.externalId,
    })
    .from(schema.WorkspaceAttachments)
    .innerJoin(
      schema.Documents,
      eq(schema.WorkspaceAttachments.documentId, schema.Documents.id),
    )
    .innerJoin(
      schema.Constituents,
      eq(schema.WorkspaceAttachments.uploadedBy, schema.Constituents.id),
    )
    .where(
      and(
        eq(schema.WorkspaceAttachments.committeeId, committeeId),
        eq(schema.WorkspaceAttachments.noteId, noteId),
        isNull(schema.WorkspaceAttachments.deletedAt),
      ),
    )
    .orderBy(desc(schema.WorkspaceAttachments.uploadedAt));

  return Promise.all(
    rows.map(async (row) => ({
      id: row.id,
      committeeId: row.committeeId,
      noteId: row.noteId,
      documentId: row.documentId,
      label: row.label ?? undefined,
      originalFileName: row.originalFileName,
      type: row.type,
      size: row.size,
      previewUrl: await generateSignedDocumentPreviewUrl(row.externalId, {
        expireSeconds: 60 * 30,
      }),
      downloadUrl: await generateSignedDocumentDownloadUrl(row.externalId, {
        expireSeconds: 60 * 30,
      }),
      uploadedBy: row.uploadedBy,
      uploadedByName: `${row.uploadedFirstName} ${row.uploadedLastName}`.trim(),
      uploadedAt: row.uploadedAt,
      canDelete: isAdmin || canManage || row.uploadedBy === user.constituentId,
    })),
  );
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
}): Promise<WorkspaceAttachment> {
  if (!(await canAccessCommitteeLive(user, committeeId))) {
    throw new ApiError("You don't have permission to access this workspace", 403);
  }

  await requireLiveWorkspaceNote(committeeId, noteId);

  const documentMeta = await storeDocumentFile(file);
  let persisted = false;

  try {
    const [row] = await dbClient.db.transaction(async (tx) => {
      const [document] = await tx
        .insert(schema.Documents)
        .values({
          ...documentMeta,
          uploadedBy: user.constituentId,
        })
        .returning({ id: schema.Documents.id });

      if (!document?.id) {
        throw new Error("Failed to create document record");
      }

      return tx
        .insert(schema.WorkspaceAttachments)
        .values({
          committeeId,
          noteId,
          documentId: document.id,
          label: label?.trim() || null,
          originalFileName: file.originalname,
          uploadedBy: user.constituentId,
        })
        .returning({ id: schema.WorkspaceAttachments.id });
    });
    persisted = true;

    const [attachment] = await getWorkspaceAttachments({
      committeeId,
      noteId,
      user,
    });
    const created = attachment?.id === row.id
      ? attachment
      : (await getWorkspaceAttachments({ committeeId, noteId, user })).find(
          (item) => item.id === row.id,
        );

    if (!created) throw new ApiError("Workspace attachment was not created", 500);
    return created;
  } catch (error) {
    if (!persisted) await deleteDocumentFile(documentMeta.externalId);
    throw error;
  }
}

export async function deleteWorkspaceAttachment({
  attachmentId,
  user,
}: {
  attachmentId: string;
  user: AuthenticatedUser;
}): Promise<void> {
  const [attachment] = await dbClient.db
    .select({
      id: schema.WorkspaceAttachments.id,
      committeeId: schema.WorkspaceAttachments.committeeId,
      uploadedBy: schema.WorkspaceAttachments.uploadedBy,
      deletedAt: schema.WorkspaceAttachments.deletedAt,
      externalId: schema.Documents.externalId,
    })
    .from(schema.WorkspaceAttachments)
    .innerJoin(
      schema.Documents,
      eq(schema.WorkspaceAttachments.documentId, schema.Documents.id),
    )
    .where(eq(schema.WorkspaceAttachments.id, attachmentId))
    .limit(1);

  if (!attachment || attachment.deletedAt) {
    throw new ApiError("Workspace attachment not found", 404);
  }

  const [isAdmin, canManage] = await Promise.all([
    isSystemAdminLive(user),
    canManageCommitteeLive(user, attachment.committeeId),
  ]);

  if (!isAdmin && !canManage && attachment.uploadedBy !== user.constituentId) {
    throw new ApiError("Only the uploader, a workspace chair, or an admin can delete this attachment", 403);
  }

  await dbClient.db
    .update(schema.WorkspaceAttachments)
    .set({ deletedAt: new Date() })
    .where(eq(schema.WorkspaceAttachments.id, attachmentId));

  await deleteDocumentFile(attachment.externalId);
}

export async function getFinanceDonations({
  user,
  page,
  pageSize,
  month,
}: {
  user: AuthenticatedUser;
  page: number;
  pageSize: number;
  month?: string;
}): Promise<PaginatedWorkspaceResult<FinanceDonation>> {
  await requireWorkspaceAccess(FINANCE_ALIAS, user);
  const offset = (page - 1) * pageSize;
  const { start, end } = monthRange(month);
  const conditions = [
    eq(schema.FinancialTransactions.status, "COMPLETED"),
    gte(schema.FinancialTransactions.createdAt, start),
    lt(schema.FinancialTransactions.createdAt, end),
  ];

  const [rows, [{ total }]] = await Promise.all([
    dbClient.db
      .select({
        id: schema.Donations.id,
        amount: schema.FinancialTransactions.amount,
        currency: schema.FinancialTransactions.currency,
        status: schema.FinancialTransactions.status,
        createdAt: schema.FinancialTransactions.createdAt,
        guestName: schema.Donations.guestName,
        guestEmail: schema.Donations.guestEmail,
        note: schema.Donations.note,
        firstName: schema.Constituents.firstName,
        lastName: schema.Constituents.lastName,
        email: schema.Constituents.email,
      })
      .from(schema.Donations)
      .innerJoin(
        schema.FinancialTransactions,
        eq(schema.Donations.transactionId, schema.FinancialTransactions.id),
      )
      .leftJoin(
        schema.Constituents,
        eq(schema.Donations.constituentId, schema.Constituents.id),
      )
      .where(and(...conditions))
      .orderBy(desc(schema.FinancialTransactions.createdAt))
      .limit(pageSize)
      .offset(offset),
    dbClient.db
      .select({ total: count() })
      .from(schema.Donations)
      .innerJoin(
        schema.FinancialTransactions,
        eq(schema.Donations.transactionId, schema.FinancialTransactions.id),
      )
      .where(and(...conditions)),
  ]);

  return {
    items: rows.map((row) => ({
      id: row.id,
      amount: row.amount,
      currency: row.currency,
      status: row.status,
      donorName:
        row.guestName ||
        `${row.firstName ?? ""} ${row.lastName ?? ""}`.trim() ||
        "Anonymous donor",
      donorEmail: row.guestEmail ?? row.email,
      note: row.note,
      createdAt: row.createdAt,
    })),
    page,
    pageSize,
    total,
  };
}

export async function getFinanceExpenditures({
  user,
  page,
  pageSize,
  month,
}: {
  user: AuthenticatedUser;
  page: number;
  pageSize: number;
  month?: string;
}): Promise<PaginatedWorkspaceResult<FinanceExpenditure>> {
  await requireWorkspaceAccess(FINANCE_ALIAS, user);
  const offset = (page - 1) * pageSize;
  const { start, end } = monthRange(month);
  const conditions = [
    gte(schema.Expenditures.timestamp, start),
    lt(schema.Expenditures.timestamp, end),
  ];

  const [rows, [{ total }]] = await Promise.all([
    dbClient.db
      .select({
        id: schema.Expenditures.id,
        amount: schema.Expenditures.amount,
        currency: schema.Expenditures.currency,
        description: schema.Expenditures.description,
        category: schema.Expenditures.category,
        timestamp: schema.Expenditures.timestamp,
      })
      .from(schema.Expenditures)
      .where(and(...conditions))
      .orderBy(desc(schema.Expenditures.timestamp))
      .limit(pageSize)
      .offset(offset),
    dbClient.db
      .select({ total: count() })
      .from(schema.Expenditures)
      .where(and(...conditions)),
  ]);

  return { items: rows, page, pageSize, total };
}

export async function createFinanceExpenditure({
  user,
  amount,
  currency,
  description,
  category,
  timestamp,
}: {
  user: AuthenticatedUser;
  amount: number;
  currency: string;
  description: string;
  category?: string;
  timestamp?: string;
}): Promise<FinanceExpenditure> {
  await requireWorkspaceManageAccess(
    FINANCE_ALIAS,
    user,
    "Only Finance chairs and admins can record expenditures",
  );
  const [row] = await dbClient.db
    .insert(schema.Expenditures)
    .values({
      amount: amount.toFixed(2),
      currency: currency.toUpperCase(),
      description,
      category,
      timestamp: timestamp ? new Date(timestamp) : new Date(),
    })
    .returning();
  return row;
}

export async function getFinanceBudgets({
  user,
  page,
  pageSize,
  month,
}: {
  user: AuthenticatedUser;
  page: number;
  pageSize: number;
  month?: string;
}): Promise<PaginatedWorkspaceResult<FinanceBudgetRequest>> {
  const committee = await requireWorkspaceAccess(FINANCE_ALIAS, user);
  const offset = (page - 1) * pageSize;
  const conditions = [eq(schema.BudgetRequests.committeeId, committee.id)];
  if (month) conditions.push(eq(schema.BudgetRequests.month, normalizeMonth(month)));

  const [rows, [{ total }]] = await Promise.all([
    dbClient.db
      .select({
        id: schema.BudgetRequests.id,
        title: schema.BudgetRequests.title,
        month: schema.BudgetRequests.month,
        currency: schema.BudgetRequests.currency,
        totalAmount: schema.BudgetRequests.totalAmount,
        rationale: schema.BudgetRequests.rationale,
        lines: schema.BudgetRequests.lines,
        status: schema.BudgetRequests.status,
        submittedBy: schema.BudgetRequests.submittedBy,
        submittedAt: schema.BudgetRequests.submittedAt,
        reviewedBy: schema.BudgetRequests.reviewedBy,
        reviewedAt: schema.BudgetRequests.reviewedAt,
        reviewNote: schema.BudgetRequests.reviewNote,
        firstName: schema.Constituents.firstName,
        lastName: schema.Constituents.lastName,
      })
      .from(schema.BudgetRequests)
      .innerJoin(
        schema.Constituents,
        eq(schema.BudgetRequests.submittedBy, schema.Constituents.id),
      )
      .where(and(...conditions))
      .orderBy(desc(schema.BudgetRequests.submittedAt))
      .limit(pageSize)
      .offset(offset),
    dbClient.db
      .select({ total: count() })
      .from(schema.BudgetRequests)
      .where(and(...conditions)),
  ]);

  return {
    items: rows.map(toBudgetRequest),
    page,
    pageSize,
    total,
  };
}

export async function createFinanceBudget({
  user,
  title,
  month,
  currency,
  rationale,
  lines,
}: {
  user: AuthenticatedUser;
  title: string;
  month: string;
  currency: string;
  rationale: string;
  lines: { description: string; category?: string; amount: number; notes?: string }[];
}): Promise<FinanceBudgetRequest> {
  const committee = await requireWorkspaceManageAccess(
    FINANCE_ALIAS,
    user,
    "Only Finance chairs and admins can submit budgets",
  );
  const total = lines.reduce((sum, line) => sum + line.amount, 0);
  const [row] = await dbClient.db
    .insert(schema.BudgetRequests)
    .values({
      committeeId: committee.id,
      title,
      month: normalizeMonth(month),
      currency: currency.toUpperCase(),
      totalAmount: total.toFixed(2),
      rationale,
      lines: lines.map((line) => ({
        description: line.description,
        category: line.category,
        amount: line.amount.toFixed(2),
        notes: line.notes,
      })),
      submittedBy: user.constituentId,
      submittedAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  return {
    ...toBudgetRequest({
      ...row,
      firstName: user.fullName?.split(" ")[0] ?? "Finance",
      lastName: user.fullName?.split(" ").slice(1).join(" ") ?? "Chair",
    }),
  };
}

export async function reviewFinanceBudget({
  user,
  budgetId,
  status,
  reviewNote,
}: {
  user: AuthenticatedUser;
  budgetId: string;
  status: "APPROVED" | "REJECTED";
  reviewNote?: string;
}): Promise<FinanceBudgetRequest> {
  if (!(await isSystemAdminLive(user))) {
    throw new ApiError("Only admins can review Finance budget requests", 403);
  }

  const [row] = await dbClient.db
    .update(schema.BudgetRequests)
    .set({
      status,
      reviewNote,
      reviewedBy: user.constituentId,
      reviewedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(schema.BudgetRequests.id, budgetId))
    .returning();

  if (!row) throw new ApiError("Budget request not found", 404);

  const [submitter] = await dbClient.db
    .select({
      firstName: schema.Constituents.firstName,
      lastName: schema.Constituents.lastName,
    })
    .from(schema.Constituents)
    .where(eq(schema.Constituents.id, row.submittedBy))
    .limit(1);

  return toBudgetRequest({
    ...row,
    firstName: submitter?.firstName ?? "Finance",
    lastName: submitter?.lastName ?? "Chair",
  });
}

async function requireWorkspaceAccess(alias: string, user: AuthenticatedUser) {
  const committee = await getCommitteeByAlias(alias);
  if (!committee) throw new ApiError("Workspace not found", 404);
  if (!(await canAccessCommitteeLive(user, committee.id))) {
    throw new ApiError("You don't have permission to access this workspace", 403);
  }
  return committee;
}

async function requireWorkspaceManageAccess(
  alias: string,
  user: AuthenticatedUser,
  message = "Only committee chairs and admins can submit workspace reports",
) {
  const committee = await getCommitteeByAlias(alias);
  if (!committee) throw new ApiError("Workspace not found", 404);
  if (!(await canManageCommitteeLive(user, committee.id))) {
    throw new ApiError(message, 403);
  }
  return committee;
}

async function requireLiveWorkspaceNote(committeeId: string, noteId: string) {
  const note = await dbClient.db.query.WorkspaceNotes.findFirst({
    where: eq(schema.WorkspaceNotes.id, noteId),
  });

  if (!note || note.deletedAt || note.committeeId !== committeeId) {
    throw new ApiError("Workspace record not found", 404);
  }

  return note;
}

async function getMonthlySubmissions(committeeId: string, month: Date) {
  const rows = await dbClient.db
    .select()
    .from(schema.WorkspaceMonthlySubmissions)
    .where(
      and(
        eq(schema.WorkspaceMonthlySubmissions.committeeId, committeeId),
        eq(schema.WorkspaceMonthlySubmissions.month, month),
      ),
    );

  return {
    plan: rows.find((row) => row.kind === "PLAN")
      ? toSubmission(rows.find((row) => row.kind === "PLAN")!)
      : null,
    report: rows.find((row) => row.kind === "REPORT")
      ? toSubmission(rows.find((row) => row.kind === "REPORT")!)
      : null,
  };
}

async function getProgramsRecordsReportData(monthStart: Date, nextMonthStart: Date) {
  const [
    [{ activePrograms }],
    [{ upcomingEvents }],
    [{ outcomeReports }],
    attendance,
    completedProjects,
    completedEvents,
  ] = await Promise.all([
    dbClient.db
      .select({ activePrograms: count() })
      .from(schema.Projects)
      .where(eq(schema.Projects.status, "ONGOING")),
    dbClient.db
      .select({ upcomingEvents: count() })
      .from(schema.Events)
      .where(
        and(
          eq(schema.Events.status, "UPCOMING"),
          gte(schema.Events.scheduledStart, monthStart),
          lt(schema.Events.scheduledStart, nextMonthStart),
        ),
      ),
    dbClient.db
      .select({ outcomeReports: count() })
      .from(schema.Projects)
      .where(
        and(
          eq(schema.Projects.status, "COMPLETED"),
          gte(schema.Projects.scheduledEnd, monthStart),
          lt(schema.Projects.scheduledEnd, nextMonthStart),
        ),
      ),
    dbClient.db
      .select({
        id: schema.Events.id,
        title: schema.Events.name,
        scheduledStart: schema.Events.scheduledStart,
        location: schema.Events.location,
        status: schema.Events.status,
        attendeeCount: sql<number>`count(${schema.EventAttendees.id})::int`,
        attendedCount: sql<number>`sum(case when ${schema.EventAttendees.status} = 'ATTENDED' then 1 else 0 end)::int`,
      })
      .from(schema.Events)
      .leftJoin(
        schema.EventAttendees,
        eq(schema.EventAttendees.eventId, schema.Events.id),
      )
      .where(
        and(
          or(eq(schema.Events.status, "ONGOING"), eq(schema.Events.status, "COMPLETED")),
          gte(schema.Events.scheduledStart, monthStart),
          lt(schema.Events.scheduledStart, nextMonthStart),
        ),
      )
      .groupBy(schema.Events.id)
      .orderBy(desc(schema.Events.scheduledStart))
      .limit(8),
    dbClient.db
      .select({
        id: schema.Projects.id,
        title: schema.Projects.title,
        scheduledEnd: schema.Projects.scheduledEnd,
      })
      .from(schema.Projects)
      .where(
        and(
          eq(schema.Projects.status, "COMPLETED"),
          gte(schema.Projects.scheduledEnd, monthStart),
          lt(schema.Projects.scheduledEnd, nextMonthStart),
        ),
      )
      .orderBy(desc(schema.Projects.scheduledEnd))
      .limit(8),
    dbClient.db
      .select({
        id: schema.Events.id,
        title: schema.Events.name,
        scheduledStart: schema.Events.scheduledStart,
      })
      .from(schema.Events)
      .where(
        and(
          eq(schema.Events.status, "COMPLETED"),
          gte(schema.Events.scheduledStart, monthStart),
          lt(schema.Events.scheduledStart, nextMonthStart),
        ),
      )
      .orderBy(desc(schema.Events.scheduledStart))
      .limit(8),
  ]);

  const attendanceItems = attendance.map((event) => ({
    id: event.id,
    title: event.title,
    meta: `${formatDate(event.scheduledStart)} · ${event.location || "Venue pending"}`,
    badge: event.status.toLowerCase(),
    attendeeCount: event.attendeeCount,
    attendedCount: event.attendedCount,
  }));
  const outcomeItems = [
    ...completedProjects.map((project) => ({
      id: project.id,
      title: project.title,
      meta: `Ended ${formatDate(project.scheduledEnd)}`,
      badge: "program",
    })),
    ...completedEvents.map((event) => ({
      id: event.id,
      title: event.title,
      meta: `Completed ${formatDate(event.scheduledStart)}`,
      badge: "event",
    })),
  ];

  return {
    metrics: [
      { label: "Active programs", value: activePrograms, hint: "Current portfolio" },
      { label: "Upcoming events", value: upcomingEvents, hint: "Scheduled this month" },
      { label: "Attendance logs", value: attendanceItems.length, hint: "Events ready for attendance review" },
      { label: "Outcome reports", value: outcomeReports + completedEvents.length, hint: "Completed work requiring outcomes" },
    ],
    attendance: attendanceItems,
    outcomes: outcomeItems,
    generatedItems: [],
  };
}

async function getHrReportData(monthStart: Date, nextMonthStart: Date) {
  const [
    [{ pendingMembership }],
    [{ acceptedMembership }],
    [{ pendingVolunteer }],
    [{ acceptedVolunteer }],
    [{ acceptedThisMonth }],
    recentMembership,
    recentVolunteer,
  ] = await Promise.all([
    dbClient.db
      .select({ pendingMembership: count() })
      .from(schema.MembershipApplications)
      .innerJoin(
        schema.Applications,
        eq(schema.MembershipApplications.applicationId, schema.Applications.id),
      )
      .where(eq(schema.Applications.status, "PENDING")),
    dbClient.db
      .select({ acceptedMembership: count() })
      .from(schema.MembershipApplications)
      .innerJoin(
        schema.Applications,
        eq(schema.MembershipApplications.applicationId, schema.Applications.id),
      )
      .where(eq(schema.Applications.status, "ACCEPTED")),
    dbClient.db
      .select({ pendingVolunteer: count() })
      .from(schema.VolunteerApplications)
      .innerJoin(
        schema.Applications,
        eq(schema.VolunteerApplications.applicationId, schema.Applications.id),
      )
      .where(eq(schema.Applications.status, "PENDING")),
    dbClient.db
      .select({ acceptedVolunteer: count() })
      .from(schema.VolunteerApplications)
      .innerJoin(
        schema.Applications,
        eq(schema.VolunteerApplications.applicationId, schema.Applications.id),
      )
      .where(eq(schema.Applications.status, "ACCEPTED")),
    dbClient.db
      .select({ acceptedThisMonth: count() })
      .from(schema.MembershipApplications)
      .innerJoin(
        schema.Applications,
        eq(schema.MembershipApplications.applicationId, schema.Applications.id),
      )
      .where(
        and(
          eq(schema.Applications.status, "ACCEPTED"),
          gte(schema.Applications.updatedAt, monthStart),
          lt(schema.Applications.updatedAt, nextMonthStart),
        ),
      ),
    dbClient.db
      .select({
        id: schema.MembershipApplications.id,
        trackingNumber: schema.Applications.trackingNumber,
        status: schema.Applications.status,
        createdAt: schema.Applications.createdAt,
        firstName: schema.Constituents.firstName,
        lastName: schema.Constituents.lastName,
      })
      .from(schema.MembershipApplications)
      .innerJoin(
        schema.Applications,
        eq(schema.MembershipApplications.applicationId, schema.Applications.id),
      )
      .innerJoin(
        schema.Constituents,
        eq(schema.Applications.constituentId, schema.Constituents.id),
      )
      .orderBy(desc(schema.Applications.createdAt))
      .limit(6),
    dbClient.db
      .select({
        id: schema.VolunteerApplications.id,
        trackingNumber: schema.Applications.trackingNumber,
        status: schema.Applications.status,
        createdAt: schema.Applications.createdAt,
        firstName: schema.Constituents.firstName,
        lastName: schema.Constituents.lastName,
      })
      .from(schema.VolunteerApplications)
      .innerJoin(
        schema.Applications,
        eq(schema.VolunteerApplications.applicationId, schema.Applications.id),
      )
      .innerJoin(
        schema.Constituents,
        eq(schema.Applications.constituentId, schema.Constituents.id),
      )
      .orderBy(desc(schema.Applications.createdAt))
      .limit(6),
  ]);

  const membershipItems = recentMembership.map((application) => ({
    id: application.id,
    title: `${application.firstName} ${application.lastName}`.trim(),
    meta: `${application.trackingNumber} · ${formatDate(application.createdAt)}`,
    badge: `membership:${application.status.toLowerCase()}`,
  }));
  const volunteerItems = recentVolunteer.map((application) => ({
    id: application.id,
    title: `${application.firstName} ${application.lastName}`.trim(),
    meta: `${application.trackingNumber} · ${formatDate(application.createdAt)}`,
    badge: `volunteer:${application.status.toLowerCase()}`,
  }));

  return {
    metrics: [
      { label: "Membership pending", value: pendingMembership, hint: "Website membership forms awaiting HR" },
      { label: "Volunteer pending", value: pendingVolunteer, hint: "Website volunteer forms awaiting HR" },
      { label: "Approved members", value: acceptedMembership, hint: "Membership applications accepted" },
      { label: "Accepted this month", value: acceptedThisMonth, hint: "New member approvals in this report month" },
    ],
    attendance: membershipItems,
    outcomes: volunteerItems,
    generatedItems: [
      {
        id: "onboarding",
        title: `${acceptedMembership} approved member${acceptedMembership === 1 ? "" : "s"} in onboarding scope`,
        meta: "Accepted members feed the first-login queue automatically",
        badge: "onboarding",
      },
      {
        id: "volunteers",
        title: `${acceptedVolunteer} accepted volunteer${acceptedVolunteer === 1 ? "" : "s"}`,
        meta: "Volunteer application decisions captured by HR",
        badge: "volunteer",
      },
    ],
  };
}

type WelfareWorkspaceRecord = {
  id: string;
  area: "cases" | "beneficiaries" | "outreach";
  category: string;
  title: string;
  status: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  owner?: string;
  subject?: string;
  followUpDate?: string;
  amountNeeded?: string;
  handoff?: string;
  details: string;
  outcome?: string;
  authorName: string;
  createdAt: Date;
};

async function getWelfareReportData(
  committeeId: string,
  monthStart: Date,
  nextMonthStart: Date,
) {
  const rows = await dbClient.db
    .select({
      id: schema.WorkspaceNotes.id,
      body: schema.WorkspaceNotes.body,
      createdAt: schema.WorkspaceNotes.createdAt,
      authorFirstName: schema.Constituents.firstName,
      authorLastName: schema.Constituents.lastName,
    })
    .from(schema.WorkspaceNotes)
    .innerJoin(
      schema.Constituents,
      eq(schema.WorkspaceNotes.authorId, schema.Constituents.id),
    )
    .where(
      and(
        eq(schema.WorkspaceNotes.committeeId, committeeId),
        eq(schema.WorkspaceNotes.entityType, "workspace"),
        isNull(schema.WorkspaceNotes.deletedAt),
      ),
    )
    .orderBy(desc(schema.WorkspaceNotes.createdAt));

  const records = rows
    .map((row) =>
      parseWelfareRecord({
        ...row,
        authorName: `${row.authorFirstName} ${row.authorLastName}`.trim(),
      }),
    )
    .filter((record): record is WelfareWorkspaceRecord => Boolean(record));
  const monthRecords = records.filter(
    (record) => record.createdAt >= monthStart && record.createdAt < nextMonthStart,
  );
  const openCases = records.filter(
    (record) => record.area === "cases" && !isWelfareClosedStatus(record.status),
  );
  const urgentRecords = records.filter(
    (record) =>
      record.priority === "URGENT" && !isWelfareClosedStatus(record.status),
  );
  const activeBeneficiaries = records.filter(
    (record) =>
      record.area === "beneficiaries" &&
      ["ACTIVE", "MONITORING"].includes(record.status),
  );
  const outreachPlans = records.filter(
    (record) =>
      record.area === "outreach" &&
      !["COMPLETED", "BLOCKED"].includes(record.status),
  );
  const closedRecords = records.filter((record) =>
    isWelfareClosedStatus(record.status),
  );

  return {
    metrics: [
      {
        label: "Open cases",
        value: openCases.length,
        hint: "Welfare cases still needing care or resolution",
      },
      {
        label: "Urgent welfare",
        value: urgentRecords.length,
        hint: "Urgent records across cases, beneficiaries, and outreach",
      },
      {
        label: "Active beneficiaries",
        value: activeBeneficiaries.length,
        hint: "Beneficiaries still being monitored or supported",
      },
      {
        label: "Outreach plans",
        value: outreachPlans.length,
        hint: "Care desk, distribution, and welfare outreach still active",
      },
    ],
    attendance: openCases.slice(0, 8).map((record) => ({
      id: record.id,
      title: record.title,
      meta: welfareMeta(record),
      badge: record.status.toLowerCase(),
    })),
    outcomes: closedRecords.slice(0, 8).map((record) => ({
      id: record.id,
      title: record.title,
      meta: record.outcome || welfareMeta(record),
      badge: record.area,
    })),
    generatedItems: [
      {
        id: "month-activity",
        title: `${monthRecords.length} welfare record${monthRecords.length === 1 ? "" : "s"} logged this month`,
        meta: "Generated from Welfare workspace case, beneficiary, and outreach records",
        badge: "monthly",
      },
      {
        id: "handoffs",
        title: `${records.filter((record) => record.handoff && record.handoff !== "None").length} active handoff${records.filter((record) => record.handoff && record.handoff !== "None").length === 1 ? "" : "s"}`,
        meta: "Handoffs remain documented inside the Welfare workspace",
        badge: "handoff",
      },
      {
        id: "closed",
        title: `${closedRecords.length} resolved or completed welfare item${closedRecords.length === 1 ? "" : "s"}`,
        meta: "Outcome records available for monthly reporting",
        badge: "outcome",
      },
    ],
  };
}

type GraphicsWorkspaceRecord = {
  id: string;
  area: "requests" | "brand" | "templates";
  category: string;
  title: string;
  status: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  owner?: string;
  requestingCommittee?: string;
  assetType?: string;
  format?: string;
  dueDate?: string;
  approvalState?: string;
  handoff?: string;
  assetUrl?: string;
  details: string;
  outcome?: string;
  authorName: string;
  createdAt: Date;
};

async function getGraphicsReportData(
  committeeId: string,
  monthStart: Date,
  nextMonthStart: Date,
) {
  const rows = await dbClient.db
    .select({
      id: schema.WorkspaceNotes.id,
      body: schema.WorkspaceNotes.body,
      createdAt: schema.WorkspaceNotes.createdAt,
      authorFirstName: schema.Constituents.firstName,
      authorLastName: schema.Constituents.lastName,
    })
    .from(schema.WorkspaceNotes)
    .innerJoin(
      schema.Constituents,
      eq(schema.WorkspaceNotes.authorId, schema.Constituents.id),
    )
    .where(
      and(
        eq(schema.WorkspaceNotes.committeeId, committeeId),
        eq(schema.WorkspaceNotes.entityType, "workspace"),
        isNull(schema.WorkspaceNotes.deletedAt),
      ),
    )
    .orderBy(desc(schema.WorkspaceNotes.createdAt));

  const records = rows
    .map((row) =>
      parseGraphicsRecord({
        ...row,
        authorName: `${row.authorFirstName} ${row.authorLastName}`.trim(),
      }),
    )
    .filter((record): record is GraphicsWorkspaceRecord => Boolean(record));
  const monthRecords = records.filter(
    (record) => record.createdAt >= monthStart && record.createdAt < nextMonthStart,
  );
  const openRequests = records.filter(
    (record) => record.area === "requests" && !isGraphicsClosedStatus(record.status),
  );
  const brandAssets = records.filter((record) => record.area === "brand");
  const templates = records.filter((record) => record.area === "templates");
  const approvedItems = records.filter(
    (record) =>
      record.approvalState === "APPROVED" ||
      ["APPROVED", "DELIVERED", "PUBLISHED"].includes(record.status),
  );
  const urgentItems = records.filter(
    (record) => record.priority === "URGENT" && !isGraphicsClosedStatus(record.status),
  );
  const handoffs = records.filter(
    (record) => record.handoff && record.handoff !== "None",
  );

  return {
    metrics: [
      {
        label: "Open requests",
        value: openRequests.length,
        hint: "Design briefs still needing Graphics action",
      },
      {
        label: "Brand assets",
        value: brandAssets.length,
        hint: "Identity, logo, color, and visual-rule records",
      },
      {
        label: "Templates",
        value: templates.length,
        hint: "Reusable design templates tracked by Graphics",
      },
      {
        label: "Approved items",
        value: approvedItems.length,
        hint: "Approved, delivered, or published design outputs",
      },
    ],
    attendance: openRequests.slice(0, 8).map((record) => ({
      id: record.id,
      title: record.title,
      meta: graphicsMeta(record),
      badge: record.status.toLowerCase(),
    })),
    outcomes: approvedItems.slice(0, 8).map((record) => ({
      id: record.id,
      title: record.title,
      meta: record.outcome || graphicsMeta(record),
      badge: record.area,
    })),
    generatedItems: [
      {
        id: "month-activity",
        title: `${monthRecords.length} graphics record${monthRecords.length === 1 ? "" : "s"} logged this month`,
        meta: "Generated from design requests, brand assets, and templates",
        badge: "monthly",
      },
      {
        id: "urgent",
        title: `${urgentItems.length} urgent design item${urgentItems.length === 1 ? "" : "s"}`,
        meta: "High-priority visual production requiring attention",
        badge: "urgent",
      },
      {
        id: "handoffs",
        title: `${handoffs.length} design handoff${handoffs.length === 1 ? "" : "s"}`,
        meta: "Cross-committee design support and final export routing",
        badge: "handoff",
      },
      {
        id: "brand-library",
        title: `${brandAssets.length} brand library item${brandAssets.length === 1 ? "" : "s"}`,
        meta: "Public identity, logo, color, and visual-rule records",
        badge: "brand",
      },
    ],
  };
}

type MediaWorkspaceRecord = {
  id: string;
  area: "requests" | "calendar" | "assets" | "website";
  category: string;
  title: string;
  status: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  owner?: string;
  requestingCommittee?: string;
  route?: string;
  channel?: string;
  dueDate?: string;
  publishDate?: string;
  approvalState?: string;
  handoff?: string;
  assetUrl?: string;
  details: string;
  outcome?: string;
  authorName: string;
  createdAt: Date;
};

const PUBLIC_WEBSITE_SURFACES = [
  { id: "home", title: "Home", owner: "Media & Content", route: "/" },
  { id: "about", title: "About", owner: "Media & Content", route: "/about" },
  { id: "services", title: "Services", owner: "Media & Content", route: "/services" },
  { id: "membership", title: "Membership", owner: "Human Resource Management", route: "/membership" },
  { id: "volunteer", title: "Volunteer", owner: "Human Resource Management", route: "/volunteer" },
  { id: "projects", title: "Projects", owner: "Programs & Records", route: "/projects" },
  { id: "project-detail", title: "Project Detail", owner: "Programs & Records", route: "/projects/:id" },
  { id: "events", title: "Events", owner: "Programs & Records", route: "/events" },
  { id: "gallery", title: "Gallery", owner: "Media & Content", route: "/gallery" },
  { id: "donate", title: "Donate", owner: "Financial Committee", route: "/donate" },
  { id: "shop", title: "Shop", owner: "Financial Committee", route: "/shop" },
  { id: "checkout", title: "Checkout", owner: "Financial Committee", route: "/checkout" },
  { id: "contact", title: "Contact", owner: "Media & Content", route: "/contact" },
  { id: "brand", title: "Visual Identity", owner: "Graphics Team", route: "Public brand assets" },
  { id: "platform", title: "Website Reliability", owner: "Technical Committee", route: "Public platform health" },
] as const;

async function getMediaReportData(
  committeeId: string,
  monthStart: Date,
  nextMonthStart: Date,
) {
  const rows = await dbClient.db
    .select({
      id: schema.WorkspaceNotes.id,
      body: schema.WorkspaceNotes.body,
      createdAt: schema.WorkspaceNotes.createdAt,
      authorFirstName: schema.Constituents.firstName,
      authorLastName: schema.Constituents.lastName,
    })
    .from(schema.WorkspaceNotes)
    .innerJoin(
      schema.Constituents,
      eq(schema.WorkspaceNotes.authorId, schema.Constituents.id),
    )
    .where(
      and(
        eq(schema.WorkspaceNotes.committeeId, committeeId),
        eq(schema.WorkspaceNotes.entityType, "workspace"),
        isNull(schema.WorkspaceNotes.deletedAt),
      ),
    )
    .orderBy(desc(schema.WorkspaceNotes.createdAt));

  const records = rows
    .map((row) =>
      parseMediaRecord({
        ...row,
        authorName: `${row.authorFirstName} ${row.authorLastName}`.trim(),
      }),
    )
    .filter((record): record is MediaWorkspaceRecord => Boolean(record));
  const monthRecords = records.filter(
    (record) => record.createdAt >= monthStart && record.createdAt < nextMonthStart,
  );
  const openRequests = records.filter(
    (record) =>
      record.area === "requests" && !isMediaClosedStatus(record.status),
  );
  const dueItems = records.filter(
    (record) =>
      !isMediaClosedStatus(record.status) &&
      Boolean(record.dueDate || record.publishDate),
  );
  const approvedItems = records.filter(
    (record) =>
      record.approvalState === "APPROVED" ||
      ["APPROVED", "SCHEDULED", "PUBLISHED"].includes(record.status),
  );
  const assetItems = records.filter((record) => record.area === "assets");
  const publishedItems = records.filter((record) =>
    ["PUBLISHED", "ARCHIVED"].includes(record.status),
  );
  const handoffs = records.filter(
    (record) => record.handoff && record.handoff !== "None",
  );

  return {
    metrics: [
      {
        label: "Open requests",
        value: openRequests.length,
        hint: "Content requests still needing Media action",
      },
      {
        label: "Publishing calendar",
        value: dueItems.length,
        hint: "Open items with due or publish dates",
      },
      {
        label: "Approved items",
        value: approvedItems.length,
        hint: "Approved, scheduled, or published communications",
      },
      {
        label: "Website surfaces",
        value: PUBLIC_WEBSITE_SURFACES.length,
        hint: "Public website functions distributed to committees",
      },
    ],
    attendance: dueItems.slice(0, 8).map((record) => ({
      id: record.id,
      title: record.title,
      meta: mediaMeta(record),
      badge: record.status.toLowerCase(),
    })),
    outcomes: publishedItems.slice(0, 8).map((record) => ({
      id: record.id,
      title: record.title,
      meta: record.outcome || mediaMeta(record),
      badge: record.area,
    })),
    generatedItems: [
      {
        id: "month-activity",
        title: `${monthRecords.length} media record${monthRecords.length === 1 ? "" : "s"} logged this month`,
        meta: "Generated from Media requests, calendar items, assets, and website reviews",
        badge: "monthly",
      },
      {
        id: "assets",
        title: `${assetItems.length} media asset${assetItems.length === 1 ? "" : "s"} tracked`,
        meta: "Gallery, campaign, press, and event evidence records",
        badge: "assets",
      },
      {
        id: "handoffs",
        title: `${handoffs.length} public handoff${handoffs.length === 1 ? "" : "s"}`,
        meta: "Cross-committee website and publishing responsibilities",
        badge: "handoff",
      },
      ...PUBLIC_WEBSITE_SURFACES.slice(0, 5).map((surface) => ({
        id: `website-${surface.id}`,
        title: `${surface.title} owned by ${surface.owner}`,
        meta: surface.route,
        badge: "website",
      })),
    ],
  };
}

async function getFinanceReportData(monthStart: Date, nextMonthStart: Date) {
  const monthStartDate = monthStart.toISOString().slice(0, 10);
  const nextMonthStartDate = nextMonthStart.toISOString().slice(0, 10);
  const [
    [{ members }],
    [{ duesCollected, duesPayments }],
    [{ donationsCollected, donations }],
    [{ expendituresTotal, expenditures }],
    [{ activePartnerships }],
    currentDues,
    latestDuesPayments,
    latestDonations,
    latestExpenditures,
  ] = await Promise.all([
    dbClient.db
      .select({ members: count() })
      .from(schema.Members)
      .where(
        and(
          sql`${schema.Members.startedAt} <= now()`,
          or(isNull(schema.Members.endedAt), sql`${schema.Members.endedAt} >= now()`),
        ),
      ),
    dbClient.db
      .select({
        duesCollected: sql<string>`COALESCE(SUM(${schema.FinancialTransactions.amount}), 0)::text`,
        duesPayments: sql<number>`COUNT(${schema.DuesPayments.id})::int`,
      })
      .from(schema.DuesPayments)
      .innerJoin(
        schema.FinancialTransactions,
        eq(schema.DuesPayments.transactionId, schema.FinancialTransactions.id),
      )
      .where(
        and(
          eq(schema.FinancialTransactions.status, "COMPLETED"),
          gte(schema.FinancialTransactions.createdAt, monthStart),
          lt(schema.FinancialTransactions.createdAt, nextMonthStart),
        ),
      ),
    dbClient.db
      .select({
        donationsCollected: sql<string>`COALESCE(SUM(${schema.FinancialTransactions.amount}), 0)::text`,
        donations: sql<number>`COUNT(${schema.Donations.id})::int`,
      })
      .from(schema.Donations)
      .innerJoin(
        schema.FinancialTransactions,
        eq(schema.Donations.transactionId, schema.FinancialTransactions.id),
      )
      .where(
        and(
          eq(schema.FinancialTransactions.status, "COMPLETED"),
          gte(schema.FinancialTransactions.createdAt, monthStart),
          lt(schema.FinancialTransactions.createdAt, nextMonthStart),
        ),
      ),
    dbClient.db
      .select({
        expendituresTotal: sql<string>`COALESCE(SUM(${schema.Expenditures.amount}), 0)::text`,
        expenditures: sql<number>`COUNT(${schema.Expenditures.id})::int`,
      })
      .from(schema.Expenditures)
      .where(
        and(
          gte(schema.Expenditures.timestamp, monthStart),
          lt(schema.Expenditures.timestamp, nextMonthStart),
        ),
      ),
    dbClient.db
      .select({ activePartnerships: count() })
      .from(schema.Partnerships)
      .where(
        and(
          sql`${schema.Partnerships.startedAt} <= ${nextMonthStartDate}`,
          or(
            isNull(schema.Partnerships.endedAt),
            sql`${schema.Partnerships.endedAt} >= ${monthStartDate}`,
          ),
        ),
      ),
    dbClient.db
      .select({
        id: schema.Dues.id,
        amount: schema.Dues.amount,
        currency: schema.Dues.currency,
        periodStart: schema.Dues.periodStart,
        periodEnd: schema.Dues.periodEnd,
      })
      .from(schema.Dues)
      .where(
        and(
          isNull(schema.Dues.chapterId),
          sql`${schema.Dues.periodStart} >= ${monthStartDate}`,
          sql`${schema.Dues.periodStart} < ${nextMonthStartDate}`,
        ),
      )
      .limit(1),
    dbClient.db
      .select({
        id: schema.DuesPayments.id,
        amount: schema.FinancialTransactions.amount,
        currency: schema.FinancialTransactions.currency,
        createdAt: schema.FinancialTransactions.createdAt,
        firstName: schema.Constituents.firstName,
        lastName: schema.Constituents.lastName,
      })
      .from(schema.DuesPayments)
      .innerJoin(
        schema.FinancialTransactions,
        eq(schema.DuesPayments.transactionId, schema.FinancialTransactions.id),
      )
      .innerJoin(schema.Members, eq(schema.DuesPayments.memberId, schema.Members.id))
      .innerJoin(
        schema.Constituents,
        eq(schema.Members.constituentId, schema.Constituents.id),
      )
      .where(
        and(
          eq(schema.FinancialTransactions.status, "COMPLETED"),
          gte(schema.FinancialTransactions.createdAt, monthStart),
          lt(schema.FinancialTransactions.createdAt, nextMonthStart),
        ),
      )
      .orderBy(desc(schema.FinancialTransactions.createdAt))
      .limit(5),
    dbClient.db
      .select({
        id: schema.Donations.id,
        amount: schema.FinancialTransactions.amount,
        currency: schema.FinancialTransactions.currency,
        createdAt: schema.FinancialTransactions.createdAt,
        guestName: schema.Donations.guestName,
        firstName: schema.Constituents.firstName,
        lastName: schema.Constituents.lastName,
      })
      .from(schema.Donations)
      .innerJoin(
        schema.FinancialTransactions,
        eq(schema.Donations.transactionId, schema.FinancialTransactions.id),
      )
      .leftJoin(
        schema.Constituents,
        eq(schema.Donations.constituentId, schema.Constituents.id),
      )
      .where(
        and(
          eq(schema.FinancialTransactions.status, "COMPLETED"),
          gte(schema.FinancialTransactions.createdAt, monthStart),
          lt(schema.FinancialTransactions.createdAt, nextMonthStart),
        ),
      )
      .orderBy(desc(schema.FinancialTransactions.createdAt))
      .limit(5),
    dbClient.db
      .select({
        id: schema.Expenditures.id,
        amount: schema.Expenditures.amount,
        currency: schema.Expenditures.currency,
        description: schema.Expenditures.description,
        category: schema.Expenditures.category,
        timestamp: schema.Expenditures.timestamp,
      })
      .from(schema.Expenditures)
      .where(
        and(
          gte(schema.Expenditures.timestamp, monthStart),
          lt(schema.Expenditures.timestamp, nextMonthStart),
        ),
      )
      .orderBy(desc(schema.Expenditures.timestamp))
      .limit(5),
  ]);

  const currentDue = currentDues[0];
  const duesTarget = currentDue ? Number(currentDue.amount) * members : 0;
  const collected = Number(duesCollected) + Number(donationsCollected);

  const attendance = latestDuesPayments.map((payment) => ({
    id: payment.id,
    title: `${payment.firstName} ${payment.lastName}`.trim() || "Member payment",
    meta: `${money(Number(payment.amount), payment.currency)} dues payment · ${formatDate(payment.createdAt)}`,
    badge: "dues",
  }));

  const outcomes = [
    ...latestDonations.map((donation) => ({
      id: donation.id,
      title:
        donation.guestName ||
        `${donation.firstName ?? ""} ${donation.lastName ?? ""}`.trim() ||
        "Donation",
      meta: `${money(Number(donation.amount), donation.currency)} donation · ${formatDate(donation.createdAt)}`,
      badge: "donation",
    })),
    ...latestExpenditures.map((expense) => ({
      id: expense.id,
      title: expense.description,
      meta: `${money(Number(expense.amount), expense.currency)} expense · ${expense.category || "uncategorized"}`,
      badge: "expense",
    })),
  ];

  return {
    metrics: [
      {
        label: "Dues collected",
        value: money(Number(duesCollected)),
        hint: `${duesPayments} completed payment${duesPayments === 1 ? "" : "s"} this month`,
      },
      {
        label: "Donations",
        value: money(Number(donationsCollected)),
        hint: `${donations} completed donation${donations === 1 ? "" : "s"} this month`,
      },
      {
        label: "Expenditures",
        value: money(Number(expendituresTotal)),
        hint: `${expenditures} expense record${expenditures === 1 ? "" : "s"} this month`,
      },
      {
        label: "Dues target",
        value: money(duesTarget, currentDue?.currency ?? "GHS"),
        hint: currentDue
          ? `${members} active member${members === 1 ? "" : "s"} at ${money(Number(currentDue.amount), currentDue.currency)}`
          : "No dues period has been generated for this month",
      },
    ],
    attendance,
    outcomes,
    generatedItems: [
      {
        id: "net-position",
        title: `Net inflow ${money(collected - Number(expendituresTotal))}`,
        meta: "Completed dues and donations minus recorded expenditures",
        badge: "net",
      },
      {
        id: "partners",
        title: `${activePartnerships} active partnership${activePartnerships === 1 ? "" : "s"}`,
        meta: "Partnerships active during this report month",
        badge: "partners",
      },
      {
        id: "dues-period",
        title: currentDue
          ? `${money(Number(currentDue.amount), currentDue.currency)} monthly dues`
          : "No monthly dues period",
        meta: currentDue
          ? `${formatDate(currentDue.periodStart)} to ${formatDate(currentDue.periodEnd)}`
          : "Set a dues policy to generate monthly dues",
        badge: "dues",
      },
    ],
  };
}

function parseWelfareRecord(row: {
  id: string;
  body: string;
  authorName: string;
  createdAt: Date;
}): WelfareWorkspaceRecord | null {
  try {
    const parsed = JSON.parse(row.body) as Partial<WelfareWorkspaceRecord> & {
      kind?: string;
    };
    if (parsed.kind !== "ypf.welfare.record.v1") return null;
    if (!parsed.area || !parsed.category || !parsed.title || !parsed.details) {
      return null;
    }
    if (!["cases", "beneficiaries", "outreach"].includes(parsed.area)) {
      return null;
    }

    return {
      id: row.id,
      area: parsed.area,
      category: parsed.category,
      title: parsed.title,
      status: parsed.status ?? "OPEN",
      priority: parsed.priority ?? "MEDIUM",
      owner: parsed.owner,
      subject: parsed.subject,
      followUpDate: parsed.followUpDate,
      amountNeeded: parsed.amountNeeded,
      handoff: parsed.handoff,
      details: parsed.details,
      outcome: parsed.outcome,
      authorName: row.authorName,
      createdAt: row.createdAt,
    };
  } catch {
    return null;
  }
}

function isWelfareClosedStatus(status: string) {
  return ["RESOLVED", "CLOSED", "FULFILLED", "COMPLETED"].includes(status);
}

function welfareMeta(record: WelfareWorkspaceRecord) {
  const chunks = [
    record.category,
    record.subject,
    record.owner ? `Owner: ${record.owner}` : undefined,
    record.followUpDate ? `Follow-up ${record.followUpDate}` : undefined,
    record.handoff && record.handoff !== "None" ? `Handoff: ${record.handoff}` : undefined,
  ].filter(Boolean);
  return chunks.join(" · ") || `${record.area} · ${formatDate(record.createdAt)}`;
}

function parseMediaRecord(row: {
  id: string;
  body: string;
  authorName: string;
  createdAt: Date;
}): MediaWorkspaceRecord | null {
  try {
    const parsed = JSON.parse(row.body) as Partial<MediaWorkspaceRecord> & {
      kind?: string;
    };
    if (parsed.kind !== "ypf.media.record.v1") return null;
    if (!parsed.area || !parsed.category || !parsed.title || !parsed.details) {
      return null;
    }
    if (!["requests", "calendar", "assets", "website"].includes(parsed.area)) {
      return null;
    }

    return {
      id: row.id,
      area: parsed.area,
      category: parsed.category,
      title: parsed.title,
      status: parsed.status ?? "DRAFT",
      priority: parsed.priority ?? "MEDIUM",
      owner: parsed.owner,
      requestingCommittee: parsed.requestingCommittee,
      route: parsed.route,
      channel: parsed.channel,
      dueDate: parsed.dueDate,
      publishDate: parsed.publishDate,
      approvalState: parsed.approvalState,
      handoff: parsed.handoff,
      assetUrl: parsed.assetUrl,
      details: parsed.details,
      outcome: parsed.outcome,
      authorName: row.authorName,
      createdAt: row.createdAt,
    };
  } catch {
    return null;
  }
}

function isMediaClosedStatus(status: string) {
  return ["PUBLISHED", "ARCHIVED", "COMPLETED", "APPROVED"].includes(status);
}

function mediaMeta(record: MediaWorkspaceRecord) {
  const chunks = [
    record.category,
    record.route,
    record.channel,
    record.owner ? `Owner: ${record.owner}` : undefined,
    record.publishDate ? `Publish ${record.publishDate}` : undefined,
    record.dueDate ? `Due ${record.dueDate}` : undefined,
    record.handoff && record.handoff !== "None" ? `Handoff: ${record.handoff}` : undefined,
  ].filter(Boolean);
  return chunks.join(" · ") || `${record.area} · ${formatDate(record.createdAt)}`;
}

function parseGraphicsRecord(row: {
  id: string;
  body: string;
  authorName: string;
  createdAt: Date;
}): GraphicsWorkspaceRecord | null {
  try {
    const parsed = JSON.parse(row.body) as Partial<GraphicsWorkspaceRecord> & {
      kind?: string;
    };
    if (parsed.kind !== "ypf.graphics.record.v1") return null;
    if (!parsed.area || !parsed.category || !parsed.title || !parsed.details) {
      return null;
    }
    if (!["requests", "brand", "templates"].includes(parsed.area)) {
      return null;
    }

    return {
      id: row.id,
      area: parsed.area,
      category: parsed.category,
      title: parsed.title,
      status: parsed.status ?? "REQUESTED",
      priority: parsed.priority ?? "MEDIUM",
      owner: parsed.owner,
      requestingCommittee: parsed.requestingCommittee,
      assetType: parsed.assetType,
      format: parsed.format,
      dueDate: parsed.dueDate,
      approvalState: parsed.approvalState,
      handoff: parsed.handoff,
      assetUrl: parsed.assetUrl,
      details: parsed.details,
      outcome: parsed.outcome,
      authorName: row.authorName,
      createdAt: row.createdAt,
    };
  } catch {
    return null;
  }
}

function isGraphicsClosedStatus(status: string) {
  return ["APPROVED", "DELIVERED", "ARCHIVED", "PUBLISHED"].includes(status);
}

function graphicsMeta(record: GraphicsWorkspaceRecord) {
  const chunks = [
    record.category,
    record.requestingCommittee,
    record.assetType,
    record.format,
    record.owner ? `Owner: ${record.owner}` : undefined,
    record.dueDate ? `Due ${record.dueDate}` : undefined,
    record.handoff && record.handoff !== "None" ? `Handoff: ${record.handoff}` : undefined,
  ].filter(Boolean);
  return chunks.join(" · ") || `${record.area} · ${formatDate(record.createdAt)}`;
}

function normalizeMonth(month?: string): Date {
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [year, monthIndex] = month.split("-").map(Number);
    return new Date(Date.UTC(year, monthIndex - 1, 1));
  }
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function monthRange(month?: string) {
  const start = normalizeMonth(month);
  const end = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1),
  );
  return { start, end };
}

function toBudgetRequest(row: {
  id: string;
  title: string;
  month: Date;
  currency: string;
  totalAmount: string;
  rationale: string;
  lines: FinanceBudgetRequest["lines"];
  status: "SUBMITTED" | "APPROVED" | "REJECTED";
  submittedBy: string;
  submittedAt: Date;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  reviewNote: string | null;
  firstName: string;
  lastName: string;
}): FinanceBudgetRequest {
  return {
    id: row.id,
    title: row.title,
    month: row.month,
    currency: row.currency,
    totalAmount: row.totalAmount,
    rationale: row.rationale,
    lines: row.lines,
    status: row.status,
    submittedBy: row.submittedBy,
    submittedByName: `${row.firstName} ${row.lastName}`.trim(),
    submittedAt: row.submittedAt,
    reviewedBy: row.reviewedBy,
    reviewedAt: row.reviewedAt,
    reviewNote: row.reviewNote,
  };
}

function getMonthMeta(monthStart: Date) {
  const monthEnd = new Date(
    Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0),
  );
  return {
    label: monthStart.toLocaleDateString(undefined, {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }),
    value: `${monthStart.getUTCFullYear()}-${String(monthStart.getUTCMonth() + 1).padStart(2, "0")}`,
    planDueLabel: monthStart.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    }),
    reportDueLabel: monthEnd.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    }),
  };
}

async function getAccessDescriptor(user: AuthenticatedUser, committeeId: string) {
  const canSubmit = await canManageCommitteeLive(user, committeeId);
  const isAdmin = await isSystemAdminLive(user);
  return {
    canSubmit,
    label: isAdmin
      ? "Admin submission" as const
      : canSubmit
        ? "Chair submission" as const
        : "Member view" as const,
  };
}

function getPlanStatus(monthStart: Date) {
  const now = new Date();
  const currentMonth = normalizeMonth();
  if (monthStart.getTime() !== currentMonth.getTime()) return "Required";
  return now.getUTCDate() <= 7 ? "Due now" : "Required";
}

function getReportStatus(monthStart: Date) {
  const now = new Date();
  const currentMonth = normalizeMonth();
  if (monthStart.getTime() !== currentMonth.getTime()) return "Required";
  const monthEnd = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0),
  );
  return now.getUTCDate() >= monthEnd.getUTCDate() - 6
    ? "Due now"
    : "Auto-generating";
}

function toSubmission(row: typeof schema.WorkspaceMonthlySubmissions.$inferSelect) {
  return {
    id: row.id,
    kind: row.kind,
    body: row.body,
    documentName: row.documentName ?? undefined,
    documentUrl: row.documentUrl ?? undefined,
    submittedBy: row.submittedBy,
    submittedAt: row.submittedAt,
    updatedAt: row.updatedAt,
  };
}

function formatDate(value: Date) {
  return value.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function money(value: number, currency = "GHS") {
  return `${currency} ${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
