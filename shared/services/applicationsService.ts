import { eq, desc, count, and, ilike, or } from "drizzle-orm";
import dbClient from "@/configs/db";
import schema from "@/db/schema";
import logger from "@/configs/logger";
import { ApiError } from "@/shared/types";
import { Paginated } from "@/shared/dtos";
import {
  YPFMembershipApplication,
  YPFMembershipApplicationDetail,
} from "@/features/api/v1/applications/dtos";
import { ApplicationStatus, NationalIdType } from "@/shared/utils";
import { generateSignedDocumentUrl } from "@/shared/utils/files";
import { sendApplicationAcknowledgementEmail } from "@/shared/utils/email";

type CreateMembershipApplication = {
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

export async function createMembershipApplication(
  data: CreateMembershipApplication
) {
  const { constituent: constituentData, ...remApplicationData } = data;
  const result = await dbClient.db.transaction(async (tx) => {
    const [newConstituent] = await tx
      .insert(schema.Constituents)
      .values(constituentData)
      .returning({
        id: schema.Constituents.id,
      });

    const applicationData = {
      ...remApplicationData,
      constituentId: newConstituent.id,
    };

    const [newApplication] = await tx
      .insert(schema.MembershipApplications)
      .values(applicationData)
      .returning({ id: schema.MembershipApplications.id });

    return newApplication;
  });

  // Send acknowledgement email (fire and forget)
  sendApplicationAcknowledgementEmail({
    email: constituentData.email,
    name: `${constituentData.firstName} ${constituentData.lastName}`,
  }).catch((error) => {
    logger.error("Failed to send application acknowledgement email", error);
  });

  return result;
}

export async function getMembershipApplications(query: {
  page: number;
  pageSize: number;
  status?: string;
  search?: string;
}): Promise<Paginated<YPFMembershipApplication>> {
  const { page, pageSize, status, search } = query;
  const offset = (page - 1) * pageSize;

  const conditions = [];
  if (status) conditions.push(eq(schema.MembershipApplications.status, status));

  const baseQuery = dbClient.db
    .select({
      id: schema.MembershipApplications.id,
      status: schema.MembershipApplications.status,
      createdAt: schema.MembershipApplications.createdAt,
      constituent: {
        id: schema.Constituents.id,
        firstName: schema.Constituents.firstName,
        lastName: schema.Constituents.lastName,
        email: schema.Constituents.email,
      },
    })
    .from(schema.MembershipApplications)
    .innerJoin(
      schema.Constituents,
      eq(schema.MembershipApplications.constituentId, schema.Constituents.id)
    );

  if (search) {
    conditions.push(
      or(
        ilike(schema.Constituents.email, `%${search}%`),
        ilike(schema.Constituents.firstName, `%${search}%`),
        ilike(schema.Constituents.lastName, `%${search}%`)
      )
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Execute
  const [items, totalResult] = await Promise.all([
    baseQuery
      .where(whereClause)
      .limit(pageSize)
      .offset(offset)
      .orderBy(desc(schema.MembershipApplications.createdAt)),
    dbClient.db
      .select({ count: count() })
      .from(schema.MembershipApplications)
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
          email: it.constituent.email ?? undefined,
        },
      };
    }),
    total: Number(totalResult[0]?.count || 0),
    page,
    pageSize,
  };
}

export async function getMembershipApplicationById(
  id: string
): Promise<YPFMembershipApplicationDetail | null> {
  const [application] = await dbClient.db
    .select({
      id: schema.MembershipApplications.id,
      status: schema.MembershipApplications.status,
      commitmentStatement: schema.MembershipApplications.commitmentStatement,
      referralSource: schema.MembershipApplications.referralSource,
      declinedReason: schema.MembershipApplications.declinedReason,
      createdAt: schema.MembershipApplications.createdAt,
      updatedAt: schema.MembershipApplications.updatedAt,
      approvedAt: schema.MembershipApplications.approvedAt,
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
    .from(schema.MembershipApplications)
    .innerJoin(
      schema.Constituents,
      eq(schema.MembershipApplications.constituentId, schema.Constituents.id)
    )
    .leftJoin(
      schema.Chapters,
      eq(schema.MembershipApplications.preferredChapterId, schema.Chapters.id)
    )
    .leftJoin(
      schema.Committees,
      eq(
        schema.MembershipApplications.preferredCommitteeId,
        schema.Committees.id
      )
    )
    .leftJoin(
      schema.Documents,
      eq(schema.MembershipApplications.cvDocumentId, schema.Documents.id)
    )
    .where(eq(schema.MembershipApplications.id, id))
    .limit(1);

  if (!application) return null;

  const detail: YPFMembershipApplicationDetail = {
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
    preferredCommittee: application.preferredCommittee
      ? {
          id: application.preferredCommittee.id,
          name: application.preferredCommittee.name,
        }
      : undefined,
    cvDocument: application.cvDocument
      ? {
          id: application.cvDocument.id,
          externalId: application.cvDocument.externalId,
          url: generateSignedDocumentUrl(application.cvDocument.externalId, {
            expireSeconds: 60 * 60,
          }),
        }
      : undefined,
  };

  return detail;
}

export async function updateMembershipApplicationStatus(
  id: string,
  newStatus: ApplicationStatus,
  adminId: string
) {
  const [updated] = await dbClient.db
    .update(schema.MembershipApplications)
    .set({
      status: newStatus,
    })
    .where(eq(schema.MembershipApplications.id, id))
    .returning();

  if (!updated) throw new ApiError("Application not found", 404);
  return updated;
}

export async function getMembershipApplicationStats() {
  const stats = await dbClient.db
    .select({
      status: schema.MembershipApplications.status,
      count: count(),
    })
    .from(schema.MembershipApplications)
    .groupBy(schema.MembershipApplications.status);

  return stats;
}
