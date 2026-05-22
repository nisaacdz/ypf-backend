import z from "zod";
import dbClient from "@/configs/db";
import schema from "@/db/schema";
import { ApiError, ApiResponse } from "@/shared/types";
import { Paginated } from "@/shared/dtos";
import { and, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import {
  CreateContactSubmissionSchema,
  GetContactSubmissionsQuerySchema,
  UpdateContactSubmissionSchema,
} from "./schemas";

type ContactSubmissionDTO = {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: "NEW" | "READ" | "REPLIED" | "SPAM";
  createdAt: Date;
  reviewedAt: Date | null;
};

/**
 * Plan §8.3 — public contact form. Persist first, queue admin notification
 * email second. The persistence is the source of truth so messages never get
 * lost even if SMTP is down.
 */
export async function createContactSubmission({
  body,
  sourceIp,
}: {
  body: z.infer<typeof CreateContactSubmissionSchema>;
  sourceIp: string | null;
}): Promise<ApiResponse<{ id: string }>> {
  const [row] = await dbClient.db
    .insert(schema.ContactSubmissions)
    .values({
      name: body.name,
      email: body.email,
      subject: body.subject,
      message: body.message,
      sourceIp: sourceIp ?? undefined,
    })
    .returning({ id: schema.ContactSubmissions.id });

  // TODO: enqueue admin notification email via pg-boss (follow-up).

  return {
    success: true,
    message: "Message received",
    data: { id: row.id },
  };
}

/**
 * Plan §8.4 — admin inbox (UMS).
 */
export async function listContactSubmissions(
  query: z.infer<typeof GetContactSubmissionsQuerySchema>,
): Promise<ApiResponse<Paginated<ContactSubmissionDTO>>> {
  const { status, search, page, pageSize } = query;
  const offset = (page - 1) * pageSize;

  const conditions = [];
  if (status) conditions.push(eq(schema.ContactSubmissions.status, status));
  if (search) {
    conditions.push(
      or(
        ilike(schema.ContactSubmissions.name, `%${search}%`),
        ilike(schema.ContactSubmissions.subject, `%${search}%`),
        sql`${schema.ContactSubmissions.email}::text ILIKE ${`%${search}%`}`,
      ),
    );
  }
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [items, totalRow] = await Promise.all([
    dbClient.db
      .select({
        id: schema.ContactSubmissions.id,
        name: schema.ContactSubmissions.name,
        email: schema.ContactSubmissions.email,
        subject: schema.ContactSubmissions.subject,
        message: schema.ContactSubmissions.message,
        status: schema.ContactSubmissions.status,
        createdAt: schema.ContactSubmissions.createdAt,
        reviewedAt: schema.ContactSubmissions.reviewedAt,
      })
      .from(schema.ContactSubmissions)
      .where(whereClause)
      .orderBy(desc(schema.ContactSubmissions.createdAt))
      .limit(pageSize)
      .offset(offset),
    dbClient.db
      .select({ n: count() })
      .from(schema.ContactSubmissions)
      .where(whereClause),
  ]);

  return {
    success: true,
    data: {
      items: items.map((r) => ({
        id: r.id,
        name: r.name,
        email: r.email,
        subject: r.subject,
        message: r.message,
        status: r.status as ContactSubmissionDTO["status"],
        createdAt: r.createdAt,
        reviewedAt: r.reviewedAt,
      })),
      page,
      pageSize,
      total: Number(totalRow[0]?.n ?? 0),
    },
  };
}

/**
 * Plan §8.5 — admin status update.
 */
export async function updateContactSubmission({
  id,
  body,
  reviewerConstituentId,
}: {
  id: string;
  body: z.infer<typeof UpdateContactSubmissionSchema>;
  reviewerConstituentId: string | null;
}): Promise<ApiResponse<null>> {
  const result = await dbClient.db
    .update(schema.ContactSubmissions)
    .set({
      status: body.status,
      reviewedBy: reviewerConstituentId,
      reviewedAt: sql`now()`,
    })
    .where(eq(schema.ContactSubmissions.id, id))
    .returning({ id: schema.ContactSubmissions.id });

  if (result.length === 0) {
    throw new ApiError("Submission not found", 404);
  }

  return {
    success: true,
    message: "Submission updated",
    data: null,
  };
}
