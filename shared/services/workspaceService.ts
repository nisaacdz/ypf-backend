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
  canAccessCommittee,
  canManageCommittee,
  getCommitteeByAlias,
  isSystemAdmin,
} from "./workspaceAccessService";

export type WorkspaceSubmissionKind = "PLAN" | "REPORT";
export type WorkspaceNoteEntityType = "program" | "event" | "workspace";

export type WorkspaceSubmission = {
  id: string;
  kind: WorkspaceSubmissionKind;
  body: string;
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
  const access = getAccessDescriptor(user, committee.id);

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
}: {
  alias: string;
  user: AuthenticatedUser;
  month?: string;
  kind: WorkspaceSubmissionKind;
  body: string;
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
        submittedBy: user.constituentId,
        submittedAt: now,
        updatedAt: now,
      },
    })
    .returning();

  return toSubmission(row);
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
  if (!canAccessCommittee(user, committeeId)) {
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
  if (!canAccessCommittee(user, committeeId)) {
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

  if (!isSystemAdmin(user) && note.authorId !== user.constituentId) {
    throw new ApiError("Only the note author or an admin can delete this note", 403);
  }

  await dbClient.db
    .update(schema.WorkspaceNotes)
    .set({ deletedAt: new Date() })
    .where(eq(schema.WorkspaceNotes.id, noteId));
}

async function requireWorkspaceAccess(alias: string, user: AuthenticatedUser) {
  const committee = await getCommitteeByAlias(alias);
  if (!committee) throw new ApiError("Workspace not found", 404);
  if (!canAccessCommittee(user, committee.id)) {
    throw new ApiError("You don't have permission to access this workspace", 403);
  }
  return committee;
}

async function requireWorkspaceManageAccess(alias: string, user: AuthenticatedUser) {
  const committee = await getCommitteeByAlias(alias);
  if (!committee) throw new ApiError("Workspace not found", 404);
  if (!canManageCommittee(user, committee.id)) {
    throw new ApiError("Only committee chairs and admins can submit workspace reports", 403);
  }
  return committee;
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

function normalizeMonth(month?: string): Date {
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [year, monthIndex] = month.split("-").map(Number);
    return new Date(Date.UTC(year, monthIndex - 1, 1));
  }
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
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

function getAccessDescriptor(user: AuthenticatedUser, committeeId: string) {
  const canSubmit = canManageCommittee(user, committeeId);
  return {
    canSubmit,
    label: isSystemAdmin(user)
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
