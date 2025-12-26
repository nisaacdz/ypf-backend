import { eq, desc, count, and, ilike, or } from "drizzle-orm";
import dbClient from "@/configs/db";
import schema from "@/db/schema";
import { ApiError } from "@/shared/types";
import { Paginated } from "@/shared/dtos";
import {
  YPFApplication,
  YPFApplicationDetail,
} from "@/features/api/v1/applications/dtos";
import { ApplicationStatus, NationalIdType } from "@/shared/utils";

type CreateApplication = {
  constituent: {
    firstName: string;
    lastName: string;
    middleName?: string;
    email: string;
    phone: string;
    nationalIdType: NationalIdType;
    nationalIdDocumentId: string;
    profilePhotoId: string;
  };
  cvDocumentId?: string;
  willingToServe: boolean;
  commitmentStatement: string;
  preferredChapterId?: string;
  preferredCommitteeId?: string;
};

export async function createApplication(data: CreateApplication) {
  let { constituent: constituentData, ...remApplicationData } = data;
  return await dbClient.db.transaction(async (tx) => {
    const [newConstituent] = await tx
      .insert(schema.Constituents)
      .values(constituentData)
      .returning({
        id: schema.Constituents.id,
      });

    let applicationData = {
      ...remApplicationData,
      constituentId: newConstituent.id,
    };

    const [newApplication] = await tx
      .insert(schema.Applications)
      .values(applicationData)
      .returning({ id: schema.Applications.id });

    return newApplication;
  });
}

export async function getApplications(query: {
  page: number;
  pageSize: number;
  status?: string;
  search?: string;
}): Promise<Paginated<YPFApplication>> {
  const { page, pageSize, status, search } = query;
  const offset = (page - 1) * pageSize;

  const conditions = [];
  if (status) conditions.push(eq(schema.Applications.status, status));

  let baseQuery = dbClient.db
    .select({
      id: schema.Applications.id,
      status: schema.Applications.status,
      createdAt: schema.Applications.createdAt,
      constituent: {
        id: schema.Constituents.id,
        firstName: schema.Constituents.firstName,
        lastName: schema.Constituents.lastName,
        email: schema.Constituents.email,
      },
    })
    .from(schema.Applications)
    .innerJoin(
      schema.Constituents,
      eq(schema.Applications.constituentId, schema.Constituents.id),
    );

  if (search) {
    conditions.push(
      or(
        ilike(schema.Constituents.email, `%${search}%`),
        ilike(schema.Constituents.firstName, `%${search}%`),
        ilike(schema.Constituents.lastName, `%${search}%`),
      ),
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Execute
  const [items, totalResult] = await Promise.all([
    baseQuery
      .where(whereClause)
      .limit(pageSize)
      .offset(offset)
      .orderBy(desc(schema.Applications.createdAt)),
    dbClient.db
      .select({ count: count() })
      .from(schema.Applications)
      .where(whereClause),
  ]);

  return {
    items: items.map((it) => {
      return {
        id: it.id,
        createdAt: it.createdAt,
        status: it.status,
        applicant: {
          id: it.constituent.id,
          fullName: `${it.constituent.firstName} ${it.constituent.lastName}`,
        },
      };
    }),
    total: Number(totalResult[0]?.count || 0),
    page,
    pageSize,
  };
}

export async function getApplicationById(
  id: string,
): Promise<YPFApplicationDetail | null> {
  const [application] = await dbClient.db
    .select({
      id: schema.Applications.id,
      status: schema.Applications.status,
      commitmentStatement: schema.Applications.commitmentStatement,
      referralSource: schema.Applications.referralSource,
      declinedReason: schema.Applications.declinedReason,
      createdAt: schema.Applications.createdAt,
      updatedAt: schema.Applications.updatedAt,
      approvedAt: schema.Applications.approvedAt,
      constituent: {
        id: schema.Constituents.id,
        firstName: schema.Constituents.firstName,
        lastName: schema.Constituents.lastName,
        email: schema.Constituents.email,
        phone: schema.Constituents.phone,
        whatsapp: schema.Constituents.whatsapp,
        occupation: schema.Constituents.occupation,
        country: schema.Constituents.country,
        region: schema.Constituents.region,
        city: schema.Constituents.city,
        campus: schema.Constituents.campus,
        skills: schema.Constituents.skills,
        previousVolunteerExperience:
          schema.Constituents.previousVolunteerExperience,
      },
      preferredChapter: {
        id: schema.Chapters.id,
        name: schema.Chapters.name,
      },
      preferredCommittee: {
        id: schema.Committees.id,
        name: schema.Committees.name,
      },
      cvDocument: {
        id: schema.Documents.id,
        externalId: schema.Documents.externalId,
      },
    })
    .from(schema.Applications)
    .innerJoin(
      schema.Constituents,
      eq(schema.Applications.constituentId, schema.Constituents.id),
    )
    .where(eq(schema.Applications.id, id))
    .limit(1);

  if (!application) return null;

  const detail: YPFApplicationDetail = {
    id: application.id,
    status: application.status,
    commitmentStatement: application.commitmentStatement ?? undefined,
    referralSource: application.referralSource ?? undefined,
    declinedReason: application.declinedReason ?? undefined,
    createdAt: application.createdAt,
    updatedAt: application.updatedAt,
    approvedAt: application.approvedAt ?? undefined,
    applicant: {
      id: application.constituent.id,
      firstName: application.constituent.firstName,
      lastName: application.constituent.lastName,
      email: application.constituent.email ?? undefined,
      phone: application.constituent.phone ?? undefined,
      occupation: application.constituent.occupation ?? undefined,
      country: application.constituent.country ?? undefined,
      region: application.constituent.region ?? undefined,
      city: application.constituent.city ?? undefined,
      campus: application.constituent.campus ?? undefined,
      skills: application.constituent.skills ?? undefined,
      previousVolunteerExperience:
        application.constituent.previousVolunteerExperience ?? undefined,
    },
    preferredChapter: application.preferredChapter
      ? {
          id: application.preferredChapter.id,
          name: application.preferredChapter.name,
        }
      : undefined,
    preferredCommittee: undefined, // Not included in current service query
    cvDocument: application.cvDocument
      ? {
          id: application.cvDocument.id,
          externalId: application.cvDocument.externalId,
        }
      : undefined,
  };

  return detail;
}

export async function updateApplicationStatus(
  id: string,
  newStatus: ApplicationStatus,
  adminId: string,
) {
  const [updated] = await dbClient.db
    .update(schema.Applications)
    .set({
      status: newStatus,
    })
    .where(eq(schema.Applications.id, id))
    .returning();

  if (!updated) throw new ApiError("Application not found", 404);
  return updated;
}

export async function getApplicationStats() {
  const stats = await dbClient.db
    .select({
      status: schema.Applications.status,
      count: count(),
    })
    .from(schema.Applications)
    .groupBy(schema.Applications.status);

  return stats;
}
