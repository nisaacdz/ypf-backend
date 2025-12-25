import { eq, and, desc, sql, count, inArray } from "drizzle-orm";
import dbClient from "@/configs/db";
import schema from "@/db/schema";
import { Paginated } from "@/shared/dtos";
import {
  YPFWelfareCase,
  YPFWelfareCaseDetail,
} from "@/features/api/v1/welfare/dtos";
import { ApiError } from "@/shared/types";
import { generatePublicMediaUrl } from "@/shared/utils/files";
import {
  GetWelfareCasesQuerySchema,
  CreateWelfareCaseSchema,
  UpdateWelfareCaseSchema,
} from "@/features/api/v1/welfare/schemas";
import z from "zod";
import * as constituentsService from "@/shared/services/constituentsService";
import { YPFConstituent } from "@/features/api/v1/constituents/dtos";
import { YPFEvent } from "@/features/api/v1/events/dtos";

/**
 * Fetches paginated welfare cases.
 */
export async function fetchWelfareCases(
  query: z.infer<typeof GetWelfareCasesQuerySchema>,
): Promise<Paginated<YPFWelfareCase>> {
  const { page, pageSize, filterType } = query;
  const offset = (page - 1) * pageSize;

  // 1. Prepare Conditions
  const whereConditions = filterType
    ? eq(schema.WelfareCases.type, filterType)
    : undefined;

  // 2. Define Subqueries (The Magic 🪄)
  // These run strictly for the current row's ID
  const beneficiaryCountSubquery = dbClient.db
    .select({ count: count() })
    .from(schema.WelfareCaseBeneficiaries)
    .where(
      eq(schema.WelfareCaseBeneficiaries.welfareCaseId, schema.WelfareCases.id),
    );

  const expenditureSumSubquery = dbClient.db
    .select({ total: sql`COALESCE(SUM(${schema.Expenditures.amount}), 0)` })
    .from(schema.Expenditures)
    .where(eq(schema.Expenditures.welfareCaseId, schema.WelfareCases.id));

  // 3. Main Query - Fetch Data + Total Count in parallel
  const [data, [{ count: total }]] = await Promise.all([
    dbClient.db
      .select({
        id: schema.WelfareCases.id,
        title: schema.WelfareCases.title,
        date: schema.WelfareCases.date,
        // Run the subqueries inline
        beneficiaryCount: sql<number>`(${beneficiaryCountSubquery})`,
        amount: sql<number>`(${expenditureSumSubquery})`,
        // Join media directly
        featuredMediumExternalId: schema.Media.externalId,
      })
      .from(schema.WelfareCases)
      // Join Media (filtered by featured=true)
      .leftJoin(
        schema.WelfareCaseMedia,
        and(
          eq(schema.WelfareCases.id, schema.WelfareCaseMedia.welfareCaseId),
          eq(schema.WelfareCaseMedia.isFeatured, true),
        ),
      )
      .leftJoin(
        schema.Media,
        eq(schema.WelfareCaseMedia.mediumId, schema.Media.id),
      )
      .where(whereConditions)
      .orderBy(desc(schema.WelfareCases.date))
      .limit(pageSize)
      .offset(offset),

    // Total count query
    dbClient.db
      .select({ count: count() })
      .from(schema.WelfareCases)
      .where(whereConditions),
  ]);

  // 4. Transform
  const items: YPFWelfareCase[] = data.map((c) => ({
    id: c.id,
    title: c.title,
    // Cast the SQL result to number
    beneficiaryCount: Number(c.beneficiaryCount),
    amount: Number(c.amount),
    isSupported: Number(c.amount) > 0,
    date: c.date ?? new Date(),
    featuredMediumUrl: c.featuredMediumExternalId
      ? generatePublicMediaUrl(c.featuredMediumExternalId)
      : undefined,
  }));

  return { items, page, pageSize, total };
}

/**
 * Fetches a single welfare case by ID with full details.
 */
export async function fetchWelfareCaseById(
  welfareCaseId: string,
): Promise<YPFWelfareCaseDetail> {
  const db = dbClient.db;

  // 1. Fetch the Core Case
  const welfareCase = await db.query.WelfareCases.findFirst({
    where: eq(schema.WelfareCases.id, welfareCaseId),
    with: {
      chapter: true,
    },
  });

  if (!welfareCase) {
    throw new ApiError("Welfare case not found", 404);
  }

  const [beneficiaries, media, expenditure] = await Promise.all([
    db
      .select({
        id: schema.Constituents.id,
        firstName: schema.Constituents.firstName,
        lastName: schema.Constituents.lastName,
        preferredName: schema.Constituents.preferredName,
        createdAt: schema.Constituents.createdAt,
        photoExternalId: schema.Media.externalId,
      })
      .from(schema.WelfareCaseBeneficiaries)
      .innerJoin(
        schema.Constituents,
        eq(
          schema.WelfareCaseBeneficiaries.beneficiaryId,
          schema.Constituents.id,
        ),
      )
      .leftJoin(
        schema.Media,
        eq(schema.Constituents.profilePhotoId, schema.Media.id),
      )
      .where(eq(schema.WelfareCaseBeneficiaries.welfareCaseId, welfareCaseId)),

    db
      .select({
        caption: schema.WelfareCaseMedia.caption,
        externalId: schema.Media.externalId,
        type: schema.Media.type,
        width: schema.Media.width,
        height: schema.Media.height,
        size: schema.Media.size,
        uploadedAt: schema.Media.uploadedAt,
      })
      .from(schema.WelfareCaseMedia)
      .innerJoin(
        schema.Media,
        eq(schema.WelfareCaseMedia.mediumId, schema.Media.id),
      )
      .where(eq(schema.WelfareCaseMedia.welfareCaseId, welfareCaseId)),

    db
      .select({
        total: sql<number>`COALESCE(SUM(${schema.Expenditures.amount}), 0)`,
      })
      .from(schema.Expenditures)
      .where(eq(schema.Expenditures.welfareCaseId, welfareCaseId)),
  ]);

  return {
    id: welfareCase.id,
    title: welfareCase.title,
    description: welfareCase.description ?? undefined,
    date: welfareCase.date ?? undefined,
    chapter: welfareCase.chapter
      ? { id: welfareCase.chapter.id, name: welfareCase.chapter.name }
      : undefined,

    // Map Beneficiaries (No extra DB calls!)
    beneficiaries: beneficiaries.map((b) => ({
      id: b.id,
      fullName: b.preferredName ?? `${b.firstName} ${b.lastName}`,
      createdAt: b.createdAt,
      profilePhotoUrl: b.photoExternalId
        ? generatePublicMediaUrl(b.photoExternalId)
        : undefined,
    })),

    featuredMedia: media.map((m) => ({
      caption: m.caption ?? undefined,
      medium: {
        url: generatePublicMediaUrl(m.externalId),
        type: m.type,
        dimensions: { width: m.width, height: m.height },
        size: m.size,
        uploadedAt: m.uploadedAt,
      },
    })),

    expenditure:
      expenditure[0].total > 0
        ? {
            id: "aggregated", // It's a sum, not a single record
            amount: Number(expenditure[0].total),
          }
        : undefined,
  };
}

/**
 * Creates a new welfare case and optionally links beneficiaries.
 */
export async function createWelfareCase(
  data: z.infer<typeof CreateWelfareCaseSchema>,
): Promise<string> {
  const { beneficiaryIds, ...caseData } = data;

  return await dbClient.db.transaction(async (tx) => {
    // Insert the welfare case
    const [newCase] = await tx
      .insert(schema.WelfareCases)
      .values(caseData)
      .returning({ id: schema.WelfareCases.id });

    // Link beneficiaries if provided
    if (beneficiaryIds && beneficiaryIds.length > 0) {
      await tx.insert(schema.WelfareCaseBeneficiaries).values(
        beneficiaryIds.map((beneficiaryId) => ({
          welfareCaseId: newCase.id,
          beneficiaryId,
        })),
      );
    }

    return newCase.id;
  });
}

/**
 * Updates an existing welfare case.
 */
export async function updateWelfareCase(
  welfareCaseId: string,
  updates: z.infer<typeof UpdateWelfareCaseSchema>,
): Promise<void> {
  const result = await dbClient.db
    .update(schema.WelfareCases)
    .set(updates)
    .where(eq(schema.WelfareCases.id, welfareCaseId))
    .returning({ id: schema.WelfareCases.id });

  if (result.length === 0) {
    throw new ApiError("Welfare case not found", 404);
  }
}

/**
 * Deletes a welfare case.
 */
export async function deleteWelfareCase(welfareCaseId: string): Promise<void> {
  const result = await dbClient.db
    .delete(schema.WelfareCases)
    .where(eq(schema.WelfareCases.id, welfareCaseId))
    .returning({ id: schema.WelfareCases.id });

  if (result.length === 0) {
    throw new ApiError("Welfare case not found", 404);
  }
}

/**
 * Adds beneficiaries to a welfarecase
 */

export async function addWelfareCaseBeneficiaries(
  welfareCaseId: string,
  beneficiaryIds: string[],
) {
  await dbClient.db
    .insert(schema.WelfareCaseBeneficiaries)
    .values(
      beneficiaryIds.map((beneficiaryId) => ({ beneficiaryId, welfareCaseId })),
    );
}
/**
 * Removes a beneficiary from a welfarecase
 */
export async function removeWelfareCaseBeneficiary(
  welfareCaseId: string,
  beneficiaryId: string,
) {
  await dbClient.db
    .delete(schema.WelfareCaseBeneficiaries)
    .where(
      and(
        eq(schema.WelfareCaseBeneficiaries.beneficiaryId, beneficiaryId),
        eq(schema.WelfareCaseBeneficiaries.welfareCaseId, welfareCaseId),
      ),
    );
}

export async function fetchWelfareCaseEvents(
  welfareCaseId: string,
  query: { page?: number; pageSize?: number } = {},
): Promise<Paginated<YPFEvent>> {
  const { page = 1, pageSize = 10 } = query;
  const offset = (page - 1) * pageSize;

  const [events, [{ count: total }]] = await Promise.all([
    dbClient.db
      .select({
        id: schema.Events.id,
        name: schema.Events.name,
        scheduledStart: schema.Events.scheduledStart,
        scheduledEnd: schema.Events.scheduledEnd,
        location: schema.Events.location,
        type: schema.Events.type,
        status: schema.Events.status,
        featuredMediumExternalId: schema.Media.externalId,
      })
      .from(schema.Events)
      .leftJoin(
        schema.EventMedia,
        and(
          eq(schema.Events.id, schema.EventMedia.eventId),
          eq(schema.EventMedia.isFeatured, true),
        ),
      )
      .leftJoin(schema.Media, eq(schema.EventMedia.mediumId, schema.Media.id))
      .where(eq(schema.Events.welfareCaseId, welfareCaseId))
      .orderBy(desc(schema.Events.scheduledStart))
      .limit(pageSize)
      .offset(offset),
    dbClient.db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.Events)
      .where(eq(schema.Events.welfareCaseId, welfareCaseId)),
  ]);

  const items: YPFEvent[] = events.map((event) => ({
    id: event.id,
    name: event.name,
    scheduledStart: event.scheduledStart,
    scheduledEnd: event.scheduledEnd,
    location: event.location || undefined,
    type: event.type,
    status: event.status,
    featuredMediumUrl: event.featuredMediumExternalId
      ? generatePublicMediaUrl(event.featuredMediumExternalId)
      : undefined,
  }));

  return {
    items,
    page,
    pageSize,
    total,
  };
}
