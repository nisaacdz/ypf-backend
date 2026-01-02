import { eq, desc, count, and, ilike, or } from "drizzle-orm";
import dbClient from "@/configs/db";
import schema from "@/db/schema";
import logger from "@/configs/logger";
import { ApiError } from "@/shared/types";
import { Paginated } from "@/shared/dtos";
import {
  YPFMembershipApplication,
  YPFMembershipApplicationDetail,
  YPFVolunteerApplication,
  YPFVolunteerApplicationDetail,
} from "@/features/api/v1/applications/dtos";
import { MembershipApplicationStatus, NationalIdType } from "@/shared/utils";
import {
  generateSignedDocumentUrl,
  generateSignedMediaUrl,
} from "@/shared/utils/files";
import {
  sendMembershipApplicationAcknowledgementEmail,
  sendMembershipApplicationAcceptanceEmail,
} from "@/shared/utils/email";
import {
  GetMembershipApplicationsQuerySchema,
  GetVolunteerApplicationsQuerySchema,
} from "@/features/api/v1/applications/schemas";
import z from "zod";

type CreateVolunteerApplication = {
  constituent: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    whatsapp?: string;
    country?: string;
    region?: string;
    city?: string;
    occupation?: string;
    skills?: string[];
  };
  reason: string;
};

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
      .returning({
        id: schema.MembershipApplications.id,
        trackingNumber: schema.MembershipApplications.trackingNumber,
      });

    return newApplication;
  });

  // Send acknowledgement email (fire and forget)
  sendMembershipApplicationAcknowledgementEmail({
    email: constituentData.email,
    name: `${constituentData.firstName} ${constituentData.lastName}`,
    trackingNumber: result.trackingNumber,
  }).catch((error) => {
    logger.error("Failed to send application acknowledgement email", error);
  });

  return result;
}

export async function getMembershipApplications(
  query: z.infer<typeof GetMembershipApplicationsQuerySchema>
): Promise<Paginated<YPFMembershipApplication>> {
  const { page, pageSize, status, search } = query;
  const offset = (page - 1) * pageSize;

  const conditions = [];
  if (status) conditions.push(eq(schema.MembershipApplications.status, status));

  const baseQuery = dbClient.db
    .select({
      id: schema.MembershipApplications.id,
      trackingNumber: schema.MembershipApplications.trackingNumber,
      status: schema.MembershipApplications.status,
      createdAt: schema.MembershipApplications.createdAt,
      constituent: {
        id: schema.Constituents.id,
        firstName: schema.Constituents.firstName,
        lastName: schema.Constituents.lastName,
        email: schema.Constituents.email,
        phone: schema.Constituents.phone,
        occupation: schema.Constituents.occupation,
        skills: schema.Constituents.skills,
      },
      profilePhoto: {
        externalId: schema.Media.externalId,
      },
      preferredChapter: {
        name: schema.Chapters.name,
      },
      preferredCommittee: {
        name: schema.Committees.name,
      },
    })
    .from(schema.MembershipApplications)
    .innerJoin(
      schema.Constituents,
      eq(schema.MembershipApplications.constituentId, schema.Constituents.id)
    )
    .leftJoin(
      schema.Media,
      eq(schema.Constituents.profilePhotoId, schema.Media.id)
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
        trackingNumber: it.trackingNumber,
        createdAt: it.createdAt,
        status: it.status,
        applicant: {
          id: it.constituent.id,
          fullName: `${it.constituent.firstName} ${it.constituent.lastName}`,
          email: it.constituent.email ?? undefined,
          phone: it.constituent.phone ?? undefined,
          occupation: it.constituent.occupation ?? undefined,
          skills: it.constituent.skills ?? undefined,
          profilePhotoUrl: it.profilePhoto?.externalId
            ? generateSignedMediaUrl(it.profilePhoto.externalId, {
                expireSeconds: 60 * 60,
              })
            : undefined,
        },
        preferredChapterName: it.preferredChapter?.name,
        preferredCommitteeName: it.preferredCommittee?.name,
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
      trackingNumber: schema.MembershipApplications.trackingNumber,
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
        nationalIdDocumentId: schema.Constituents.nationalIdDocumentId,
      },
      profilePhoto: {
        externalId: schema.Media.externalId,
        width: schema.Media.width,
        height: schema.Media.height,
        size: schema.Media.size,
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
    .leftJoin(
      schema.Media,
      eq(schema.Constituents.profilePhotoId, schema.Media.id)
    )
    .where(eq(schema.MembershipApplications.id, id))
    .limit(1);

  if (!application) return null;

  let nationalIdDocument: { id: string; externalId: string } | undefined =
    undefined;

  if (application.constituent.nationalIdDocumentId) {
    const [doc] = await dbClient.db
      .select({
        id: schema.Documents.id,
        externalId: schema.Documents.externalId,
      })
      .from(schema.Documents)
      .where(
        eq(schema.Documents.id, application.constituent.nationalIdDocumentId)
      )
      .limit(1);
    nationalIdDocument = doc;
  }

  const detail: YPFMembershipApplicationDetail = {
    id: application.id,
    trackingNumber: application.trackingNumber,
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
      profilePhoto: application.profilePhoto?.externalId
        ? {
            url: generateSignedMediaUrl(application.profilePhoto.externalId, {
              expireSeconds: 60 * 60,
            }),
            dimensions: {
              width: application.profilePhoto.width,
              height: application.profilePhoto.height,
            },
            size: application.profilePhoto.size,
          }
        : undefined,
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
          url: generateSignedDocumentUrl(application.cvDocument.externalId, {
            expireSeconds: 60 * 60,
          }),
        }
      : undefined,
    nationalIdDocument: nationalIdDocument
      ? {
          id: nationalIdDocument.id,
          url: generateSignedDocumentUrl(nationalIdDocument.externalId, {
            expireSeconds: 60 * 60,
          }),
        }
      : undefined,
  };

  return detail;
}

export async function updateMembershipApplicationStatus(
  id: string,
  newStatus: MembershipApplicationStatus,
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

  // If accepted, send email
  if (newStatus === "ACCEPTED") {
    // Fetch constituent for email
    const [constituent] = await dbClient.db
      .select({
        firstName: schema.Constituents.firstName,
        lastName: schema.Constituents.lastName,
        email: schema.Constituents.email,
      })
      .from(schema.Constituents)
      .where(eq(schema.Constituents.id, updated.constituentId))
      .limit(1);

    if (constituent && constituent.email) {
      sendMembershipApplicationAcceptanceEmail({
        email: constituent.email,
        name: `${constituent.firstName} ${constituent.lastName}`,
        trackingNumber: updated.trackingNumber,
      }).catch((err) => {
        logger.error("Failed to send acceptance email", err);
      });
    }
  }

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

// Volunteer Application Service Methods

export async function createVolunteerApplication(
  data: CreateVolunteerApplication
) {
  const { constituent: constituentData, ...remApplicationData } = data;
  const result = await dbClient.db.transaction(async (tx) => {
    // Check if constituent exists
    let constituentId: string;
    const [existingConstituent] = await tx
      .select({ id: schema.Constituents.id })
      .from(schema.Constituents)
      .where(eq(schema.Constituents.email, constituentData.email))
      .limit(1);

    if (existingConstituent) {
      constituentId = existingConstituent.id;
      // Optionally update constituent fields if needed, but for now we assume they might just be applying
      // We could update them here if we wanted to be more aggressive
    } else {
      const [newConstituent] = await tx
        .insert(schema.Constituents)
        .values({
          ...constituentData,
          // Generate publicId automatically by DB default
        })
        .returning({
          id: schema.Constituents.id,
        });
      constituentId = newConstituent.id;
    }

    const applicationData = {
      ...remApplicationData,
      constituentId,
    };

    const [newApplication] = await tx
      .insert(schema.VolunteerApplications)
      .values(applicationData)
      .returning({
        id: schema.VolunteerApplications.id,
        trackingNumber: schema.VolunteerApplications.trackingNumber,
      });

    return newApplication;
  });

  return result;
}

export async function getVolunteerApplications(
  query: z.infer<typeof GetVolunteerApplicationsQuerySchema>
): Promise<Paginated<YPFVolunteerApplication>> {
  const { page, pageSize, status, search } = query;
  const offset = (page - 1) * pageSize;

  const conditions = [];
  if (status) conditions.push(eq(schema.VolunteerApplications.status, status));

  const baseQuery = dbClient.db
    .select({
      id: schema.VolunteerApplications.id,
      trackingNumber: schema.VolunteerApplications.trackingNumber,
      status: schema.VolunteerApplications.status,
      createdAt: schema.VolunteerApplications.createdAt,
      constituent: {
        id: schema.Constituents.id,
        firstName: schema.Constituents.firstName,
        lastName: schema.Constituents.lastName,
        email: schema.Constituents.email,
        phone: schema.Constituents.phone,
        occupation: schema.Constituents.occupation,
        skills: schema.Constituents.skills,
      },
    })
    .from(schema.VolunteerApplications)
    .innerJoin(
      schema.Constituents,
      eq(schema.VolunteerApplications.constituentId, schema.Constituents.id)
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

  const [items, totalResult] = await Promise.all([
    baseQuery
      .where(whereClause)
      .limit(pageSize)
      .offset(offset)
      .orderBy(desc(schema.VolunteerApplications.createdAt)),
    dbClient.db
      .select({ count: count() })
      .from(schema.VolunteerApplications)
      .where(whereClause),
  ]);

  return {
    items: items.map((it) => ({
      id: it.id,
      trackingNumber: it.trackingNumber,
      status: it.status,
      createdAt: it.createdAt,
      applicant: {
        id: it.constituent.id,
        fullName: `${it.constituent.firstName} ${it.constituent.lastName}`,
        email: it.constituent.email ?? undefined,
        phone: it.constituent.phone ?? undefined,
        occupation: it.constituent.occupation ?? undefined,
        skills: it.constituent.skills ?? undefined,
      },
    })),
    total: Number(totalResult[0]?.count || 0),
    page,
    pageSize,
  };
}

export async function getVolunteerApplicationById(
  id: string
): Promise<YPFVolunteerApplicationDetail | null> {
  const [application] = await dbClient.db
    .select({
      id: schema.VolunteerApplications.id,
      trackingNumber: schema.VolunteerApplications.trackingNumber,
      status: schema.VolunteerApplications.status,
      reason: schema.VolunteerApplications.reason,
      notes: schema.VolunteerApplications.notes,
      createdAt: schema.VolunteerApplications.createdAt,
      updatedAt: schema.VolunteerApplications.updatedAt,
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
        skills: schema.Constituents.skills,
      },
    })
    .from(schema.VolunteerApplications)
    .innerJoin(
      schema.Constituents,
      eq(schema.VolunteerApplications.constituentId, schema.Constituents.id)
    )
    .where(eq(schema.VolunteerApplications.id, id))
    .limit(1);

  if (!application) return null;

  return {
    id: application.id,
    trackingNumber: application.trackingNumber,
    status: application.status,
    reason: application.reason ?? undefined,
    notes: application.notes ?? undefined,
    createdAt: application.createdAt,
    updatedAt: application.updatedAt,
    applicant: {
      id: application.constituent.id,
      firstName: application.constituent.firstName,
      lastName: application.constituent.lastName,
      email: application.constituent.email ?? undefined,
      phone: application.constituent.phone ?? undefined,
      whatsapp: application.constituent.whatsapp ?? undefined,
      occupation: application.constituent.occupation ?? undefined,
      country: application.constituent.country ?? undefined,
      region: application.constituent.region ?? undefined,
      city: application.constituent.city ?? undefined,
      skills: application.constituent.skills ?? undefined,
    },
  };
}
