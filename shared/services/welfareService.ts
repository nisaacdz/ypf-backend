import { eq, and, desc, sql } from "drizzle-orm";
import dbClient from "@/configs/db";
import schema from "@/db/schema";
import { Paginated } from "@/shared/dtos";
import { WelfareCase, WelfareCaseDetail } from "@/features/api/v1/welfare/dtos";
import { ApiError } from "@/shared/types";
import { generatePublicMediaUrl } from "@/shared/utils/files";
import {
  GetWelfareCasesQuerySchema,
  CreateWelfareCaseSchema,
} from "@/features/api/v1/welfare/schemas";
import z from "zod";
import * as constituentsService from "@/shared/services/constituentsService";
import { YPFConstituent } from "@/features/api/v1/constituents/dtos";

/**
 * Fetches paginated welfare cases.
 */
export async function fetchWelfareCases(
  query: z.infer<typeof GetWelfareCasesQuerySchema>
): Promise<Paginated<WelfareCase>> {
  const { page, pageSize, filterType } = query;
  const offset = (page - 1) * pageSize;

  const whereConditions = [];
  if (filterType) {
    whereConditions.push(eq(schema.WelfareCases.type, filterType));
  }

  const whereClause = whereConditions.length
    ? and(...whereConditions)
    : undefined;

  // Fetch cases with aggregated data
  const [cases, [{ count }]] = await Promise.all([
    dbClient.db
      .select({
        id: schema.WelfareCases.id,
        title: schema.WelfareCases.title,
        type: schema.WelfareCases.type,
        date: schema.WelfareCases.date,
      })
      .from(schema.WelfareCases)
      .where(whereClause)
      .orderBy(desc(schema.WelfareCases.date))
      .limit(pageSize)
      .offset(offset),
    dbClient.db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.WelfareCases)
      .where(whereClause),
  ]);

  // Fetch beneficiary counts and expenditure amounts for each case
  const caseIds = cases.map((c) => c.id);

  const [beneficiaryCounts, expenditures, featuredMedia] = await Promise.all([
    caseIds.length
      ? dbClient.db
          .select({
            welfareCaseId: schema.WelfareCaseBeneficiaries.welfareCaseId,
            count: sql<number>`count(*)::int`,
          })
          .from(schema.WelfareCaseBeneficiaries)
          .where(
            sql`${schema.WelfareCaseBeneficiaries.welfareCaseId} = ANY(${caseIds})`
          )
          .groupBy(schema.WelfareCaseBeneficiaries.welfareCaseId)
      : [],
    caseIds.length
      ? dbClient.db
          .select({
            welfareCaseId: schema.Expenditures.welfareCaseId,
            total: sql<string>`COALESCE(SUM(${schema.Expenditures.amount}), 0)`,
          })
          .from(schema.Expenditures)
          .where(sql`${schema.Expenditures.welfareCaseId} = ANY(${caseIds})`)
          .groupBy(schema.Expenditures.welfareCaseId)
      : [],
    caseIds.length
      ? dbClient.db
          .select({
            welfareCaseId: schema.WelfareCaseMedia.welfareCaseId,
            externalId: schema.Media.externalId,
          })
          .from(schema.WelfareCaseMedia)
          .innerJoin(
            schema.Media,
            eq(schema.WelfareCaseMedia.mediumId, schema.Media.id)
          )
          .where(
            and(
              eq(schema.WelfareCaseMedia.isFeatured, true),
              sql`${schema.WelfareCaseMedia.welfareCaseId} = ANY(${caseIds})`
            )
          )
      : [],
  ]);

  const beneficiaryMap = new Map(
    beneficiaryCounts.map((b) => [b.welfareCaseId, b.count])
  );
  const expenditureMap = new Map(
    expenditures.map((e) => [e.welfareCaseId, parseFloat(e.total)])
  );
  const featuredMediaMap = new Map(
    featuredMedia.map((m) => [m.welfareCaseId, m.externalId])
  );

  const items: WelfareCase[] = cases.map((c) => ({
    id: c.id,
    title: c.title,
    featuredMediumUrl: featuredMediaMap.has(c.id)
      ? generatePublicMediaUrl(featuredMediaMap.get(c.id)!)
      : undefined,
    beneficiaryCount: beneficiaryMap.get(c.id) ?? 0,
    amount: expenditureMap.get(c.id) ?? 0,
    isSupported: expenditureMap.has(c.id),
    date: c.date ?? new Date(),
  }));

  return {
    items,
    page,
    pageSize,
    total: count,
  };
}

/**
 * Fetches a single welfare case by ID with full details.
 */
export async function fetchWelfareCaseById(
  welfareCaseId: string
): Promise<WelfareCaseDetail> {
  const welfareCase = await dbClient.db.query.WelfareCases.findFirst({
    where: eq(schema.WelfareCases.id, welfareCaseId),
  });

  if (!welfareCase) {
    throw new ApiError("Welfare case not found", 404);
  }

  // Fetch related data in parallel
  const [beneficiaries, featuredMedia, expenditure] = await Promise.all([
    // Fetch beneficiaries
    dbClient.db
      .select({
        id: schema.Constituents.id,
      })
      .from(schema.WelfareCaseBeneficiaries)
      .innerJoin(
        schema.Constituents,
        eq(
          schema.WelfareCaseBeneficiaries.beneficiaryId,
          schema.Constituents.id
        )
      )
      .leftJoin(
        schema.Media,
        eq(schema.Constituents.profilePhotoId, schema.Media.id)
      )
      .where(eq(schema.WelfareCaseBeneficiaries.welfareCaseId, welfareCaseId))
      .then(
        async (b) =>
          await Promise.all(
            b.map(async (c) => await constituentsService.getConstituent(c.id))
          )
      ),

    // Fetch featured media
    dbClient.db
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
        eq(schema.WelfareCaseMedia.mediumId, schema.Media.id)
      )
      .where(eq(schema.WelfareCaseMedia.welfareCaseId, welfareCaseId)),

    // Fetch expenditure info
    dbClient.db
      .select({
        id: schema.Expenditures.id,
        total: sql<string>`COALESCE(SUM(${schema.Expenditures.amount}), 0)`,
      })
      .from(schema.Expenditures)
      .where(eq(schema.Expenditures.welfareCaseId, welfareCaseId))
      .groupBy(schema.Expenditures.id)
      .orderBy(desc(schema.Expenditures.timestamp))
      .limit(1),
  ]);

  return {
    id: welfareCase.id,
    title: welfareCase.title,
    date: welfareCase.date ?? undefined,
    featuredMedia: featuredMedia.map((m) => ({
      caption: m.caption ?? undefined,
      medium: {
        url: generatePublicMediaUrl(m.externalId),
        type: m.type,
        dimensions: { width: m.width, height: m.height },
        size: m.size,
        uploadedAt: m.uploadedAt,
      },
    })),
    expenditure: expenditure.length
      ? {
          id: expenditure[0].id,
          amount: parseFloat(expenditure[0].total),
        }
      : undefined,
    beneficiaries: beneficiaries.filter(Boolean) as YPFConstituent[],
  };
}

/**
 * Creates a new welfare case and optionally links beneficiaries.
 */
export async function createWelfareCase(
  data: z.infer<typeof CreateWelfareCaseSchema>
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
        }))
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
  updates: Partial<{
    title: string;
    description: string;
    date: Date;
    type: "MEDICAL" | "EDUCATIONAL" | "FUNERAL" | "FINANCIAL_SUPPORT" | "OTHER";
  }>
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
  beneficiaryIds: string[]
) {
  const result = await dbClient.db
    .insert(schema.WelfareCaseBeneficiaries)
    .values(
      beneficiaryIds.map((beneficiaryId) => ({ beneficiaryId, welfareCaseId }))
    );
}
/**
 * Removes a beneficiary from a welfarecase
 */
export async function removeWelfareCaseBeneficiary(
  welfareCaseId: string,
  beneficiaryId: string
) {
  const result = await dbClient.db
    .delete(schema.WelfareCaseBeneficiaries)
    .where(eq(schema.WelfareCaseBeneficiaries.beneficiaryId, beneficiaryId));
}
