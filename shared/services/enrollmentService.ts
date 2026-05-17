import { and, eq, isNull } from "drizzle-orm";
import dbClient from "@/configs/db";
import schema from "@/db/schema";
import { ApiError } from "@/shared/types";

// ─── Event Registration ───────────────────────────────────────────────────────

export async function registerForEvent(
  eventId: string,
  constituentId: string,
): Promise<string> {
  const [event] = await dbClient.db
    .select({ id: schema.Events.id, status: schema.Events.status })
    .from(schema.Events)
    .where(eq(schema.Events.id, eventId))
    .limit(1);

  if (!event) throw new ApiError("Event not found", 404);
  if (event.status === "COMPLETED" || event.status === "CANCELLED") {
    throw new ApiError("Cannot register for a completed or cancelled event", 400);
  }

  const [existing] = await dbClient.db
    .select({ id: schema.EventAttendees.id })
    .from(schema.EventAttendees)
    .where(
      and(
        eq(schema.EventAttendees.eventId, eventId),
        eq(schema.EventAttendees.constituentId, constituentId),
      ),
    )
    .limit(1);

  if (existing) {
    return existing.id;
  }

  const [row] = await dbClient.db
    .insert(schema.EventAttendees)
    .values({ eventId, constituentId, status: "ACCEPTED" })
    .returning({ id: schema.EventAttendees.id });

  return row.id;
}

export async function unregisterFromEvent(
  eventId: string,
  constituentId: string,
): Promise<void> {
  await dbClient.db
    .delete(schema.EventAttendees)
    .where(
      and(
        eq(schema.EventAttendees.eventId, eventId),
        eq(schema.EventAttendees.constituentId, constituentId),
      ),
    );
}

export async function getMyEventRegistrations(
  constituentId: string,
): Promise<string[]> {
  const rows = await dbClient.db
    .select({ eventId: schema.EventAttendees.eventId })
    .from(schema.EventAttendees)
    .where(eq(schema.EventAttendees.constituentId, constituentId));
  return rows.map((r) => r.eventId);
}

export async function getEventAttendeeCount(eventId: string): Promise<number> {
  const rows = await dbClient.db
    .select({ id: schema.EventAttendees.id })
    .from(schema.EventAttendees)
    .where(eq(schema.EventAttendees.eventId, eventId));
  return rows.length;
}

// ─── Project Enrollment ───────────────────────────────────────────────────────

export async function enrollInProject(
  projectId: string,
  constituentId: string,
): Promise<string> {
  const [project] = await dbClient.db
    .select({ id: schema.Projects.id, status: schema.Projects.status })
    .from(schema.Projects)
    .where(eq(schema.Projects.id, projectId))
    .limit(1);

  if (!project) throw new ApiError("Project not found", 404);
  if (project.status === "COMPLETED" || project.status === "CANCELLED") {
    throw new ApiError("Cannot enroll in a completed or cancelled project", 400);
  }

  const [existing] = await dbClient.db
    .select({ id: schema.ProjectEnrollments.id, unenrolledAt: schema.ProjectEnrollments.unenrolledAt })
    .from(schema.ProjectEnrollments)
    .where(
      and(
        eq(schema.ProjectEnrollments.projectId, projectId),
        eq(schema.ProjectEnrollments.constituentId, constituentId),
      ),
    )
    .limit(1);

  if (existing && !existing.unenrolledAt) {
    return existing.id;
  }

  if (existing && existing.unenrolledAt) {
    await dbClient.db
      .update(schema.ProjectEnrollments)
      .set({ unenrolledAt: null, enrolledAt: new Date() })
      .where(eq(schema.ProjectEnrollments.id, existing.id));
    return existing.id;
  }

  const [row] = await dbClient.db
    .insert(schema.ProjectEnrollments)
    .values({ projectId, constituentId })
    .returning({ id: schema.ProjectEnrollments.id });

  return row.id;
}

export async function unenrollFromProject(
  projectId: string,
  constituentId: string,
): Promise<void> {
  await dbClient.db
    .update(schema.ProjectEnrollments)
    .set({ unenrolledAt: new Date() })
    .where(
      and(
        eq(schema.ProjectEnrollments.projectId, projectId),
        eq(schema.ProjectEnrollments.constituentId, constituentId),
        isNull(schema.ProjectEnrollments.unenrolledAt),
      ),
    );
}

export async function getMyProjectEnrollments(
  constituentId: string,
): Promise<string[]> {
  const rows = await dbClient.db
    .select({ projectId: schema.ProjectEnrollments.projectId })
    .from(schema.ProjectEnrollments)
    .where(
      and(
        eq(schema.ProjectEnrollments.constituentId, constituentId),
        isNull(schema.ProjectEnrollments.unenrolledAt),
      ),
    );
  return rows.map((r) => r.projectId);
}

export async function getProjectEnrollmentCount(
  projectId: string,
): Promise<number> {
  const rows = await dbClient.db
    .select({ id: schema.ProjectEnrollments.id })
    .from(schema.ProjectEnrollments)
    .where(
      and(
        eq(schema.ProjectEnrollments.projectId, projectId),
        isNull(schema.ProjectEnrollments.unenrolledAt),
      ),
    );
  return rows.length;
}
