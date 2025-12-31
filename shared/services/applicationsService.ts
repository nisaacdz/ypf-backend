import { eq, desc, count, and, ilike, or, sql, aliasedTable } from "drizzle-orm";
import dbClient from "@/configs/db";
import schema from "@/db/schema";
import logger from "@/configs/logger";
import { ApiError } from "@/shared/types";
import { Paginated } from "@/shared/dtos";
import {
  YPFApplication,
  YPFApplicationDetail,
} from "@/features/api/v1/applications/dtos";
import { ApplicationStatus, NationalIdType } from "@/shared/utils";
import { sendApplicationAcknowledgementEmail } from "@/shared/utils/email";
import { generateMediaBlobUrl, generateDocumentBlobUrl } from "@/shared/utils/files";
import blobServiceClient, { containerNames } from "@/configs/fs";



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
      .insert(schema.Applications)
      .values(applicationData)
      .returning({ id: schema.Applications.id });

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

  const cvDocument = aliasedTable(schema.Documents, "cvDocument");
  const nationalIdDocument = aliasedTable(schema.Documents, "nationalIdDocument");

  const baseQuery = dbClient.db
    .select({
      id: schema.Applications.id,
      status: schema.Applications.status,
      createdAt: schema.Applications.createdAt,
      declinedReason: schema.Applications.declinedReason,
      approvedAt: schema.Applications.approvedAt,
      commitmentStatement: schema.Applications.commitmentStatement,
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
        previousVolunteerExperience: schema.Constituents.previousVolunteerExperience,
        nationalIdType: schema.Constituents.nationalIdType,
        profilePhotoId: schema.Constituents.profilePhotoId,
        nationalIdDocumentId: schema.Constituents.nationalIdDocumentId,
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
        id: cvDocument.id,
        externalId: cvDocument.externalId,
        type: cvDocument.type,
      },
      profilePhoto: {
        id: schema.Media.id,
        externalId: schema.Media.externalId,
        type: schema.Media.type,
      },
      nationalIdDocument: {
        id: nationalIdDocument.id,
        externalId: nationalIdDocument.externalId,
        type: nationalIdDocument.type,
      },
    })
    .from(schema.Applications)
    .innerJoin(
      schema.Constituents,
      eq(schema.Applications.constituentId, schema.Constituents.id)
    )
    .leftJoin(
      schema.Chapters,
      eq(schema.Applications.preferredChapterId, schema.Chapters.id)
    )
    .leftJoin(
      schema.Committees,
      eq(schema.Applications.preferredCommitteeId, schema.Committees.id)
    )
    .leftJoin(
      cvDocument,
      eq(schema.Applications.cvDocumentId, cvDocument.id)
    )
    .leftJoin(
      schema.Media,
      eq(schema.Constituents.profilePhotoId, schema.Media.id)
    )
    .leftJoin(
      nationalIdDocument,
      eq(schema.Constituents.nationalIdDocumentId, nationalIdDocument.id)
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
        declinedReason: it.declinedReason,
        approvedAt: it.approvedAt,
        commitmentStatement: it.commitmentStatement,
        applicant: {
          id: it.constituent.id,
          fullName: `${it.constituent.firstName} ${it.constituent.lastName}`,
          email: it.constituent.email ?? undefined,
          firstName: it.constituent.firstName,
          lastName: it.constituent.lastName,
          phone: it.constituent.phone ?? undefined,
          country: it.constituent.country ?? undefined,
          region: it.constituent.region ?? undefined,
          city: it.constituent.city ?? undefined,
          campus: it.constituent.campus ?? undefined,
          nationalIdType: it.constituent.nationalIdType,
        },
        preferredChapter: it.preferredChapter ? {
          id: it.preferredChapter.id,
          name: it.preferredChapter.name,
        } : undefined,
        profilePhoto: it.profilePhoto ? {
          id: it.profilePhoto.id,
          url: (() => {
            try {
              return generateMediaBlobUrl(it.profilePhoto.externalId, 1440); // 24 hours
            } catch (error) {
              console.error('Error generating media blob URL for profile photo:', error);
              return undefined;
            }
          })(),
          type: it.profilePhoto.type,
        } : undefined,
        nationalIdDocument: it.nationalIdDocument ? {
          id: it.nationalIdDocument.id,
          url: (() => {
            try {
              return generateDocumentBlobUrl(it.nationalIdDocument.externalId, 1440); // 24 hours
            } catch (error) {
              console.error('Error generating document blob URL for national ID:', error);
              return undefined;
            }
          })(),
          type: it.nationalIdDocument.type,
        } : undefined,
        cvDocument: it.cvDocument ? {
          id: it.cvDocument.id,
          url: (() => {
            try {
              return generateDocumentBlobUrl(it.cvDocument.externalId, 1440); // 24 hours
            } catch (error) {
              console.error('Error generating document blob URL for CV:', error);
              return undefined;
            }
          })(),
          type: it.cvDocument.type,
        } : undefined,
      };
    }),
    total: Number(totalResult[0]?.count || 0),
    page,
    pageSize,
  };
}

export async function getApplicationById(
  id: string
): Promise<YPFApplicationDetail | null> {
  const cvDocument = aliasedTable(schema.Documents, "cvDocument");
  const nationalIdDocument = aliasedTable(schema.Documents, "nationalIdDocument");

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
        nationalIdType: schema.Constituents.nationalIdType,
        profilePhotoId: schema.Constituents.profilePhotoId,
        nationalIdDocumentId: schema.Constituents.nationalIdDocumentId,
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
        id: cvDocument.id,
        externalId: cvDocument.externalId,
        type: cvDocument.type,
      },
      profilePhoto: {
        id: schema.Media.id,
        externalId: schema.Media.externalId,
        type: schema.Media.type,
      },
      nationalIdDocument: {
        id: nationalIdDocument.id,
        externalId: nationalIdDocument.externalId,
        type: nationalIdDocument.type,
      },
    })
    .from(schema.Applications)
    .innerJoin(
      schema.Constituents,
      eq(schema.Applications.constituentId, schema.Constituents.id)
    )
    .leftJoin(
      schema.Chapters,
      eq(schema.Applications.preferredChapterId, schema.Chapters.id)
    )
    .leftJoin(
      schema.Committees,
      eq(schema.Applications.preferredCommitteeId, schema.Committees.id)
    )
    .leftJoin(
      cvDocument,
      eq(schema.Applications.cvDocumentId, cvDocument.id)
    )
    .leftJoin(
      schema.Media,
      eq(schema.Constituents.profilePhotoId, schema.Media.id)
    )
    .leftJoin(
      nationalIdDocument,
      eq(schema.Constituents.nationalIdDocumentId, nationalIdDocument.id)
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
      nationalIdType: application.constituent.nationalIdType ?? undefined,
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
        url: (() => {
          try {
            return generateDocumentBlobUrl(application.cvDocument.externalId, 1440);
          } catch (error) {
            console.error('Failed to generate CV document URL:', error);
            return '';
          }
        })(),
        type: application.cvDocument.type,
      }
      : undefined,
    profilePhoto: application.profilePhoto
      ? {
        id: application.profilePhoto.id,
        externalId: application.profilePhoto.externalId,
        url: (() => {
          try {
            return generateMediaBlobUrl(application.profilePhoto.externalId, 1440);
          } catch (error) {
            console.error('Failed to generate profile photo URL:', error);
            return '';
          }
        })(),
        type: application.profilePhoto.type,
      }
      : undefined,
    nationalIdDocument: application.nationalIdDocument
      ? {
        id: application.nationalIdDocument.id,
        externalId: application.nationalIdDocument.externalId,
        url: (() => {
          try {
            return generateDocumentBlobUrl(application.nationalIdDocument.externalId, 1440);
          } catch (error) {
            console.error('Failed to generate national ID document URL:', error);
            return '';
          }
        })(),
        type: application.nationalIdDocument.type,
      }
      : undefined,
  };

  return detail;
}

export async function getCredentialsPreview() {
  const { generatePassword, generateMemberId } = await import('../utils/credentials');
  return {
    memberId: generateMemberId(),
    password: generatePassword(),
  };
}

export async function updateApplicationStatus(
  id: string,
  newStatus: ApplicationStatus,
  adminId: string,
  declinedReason?: string,
  providedMemberId?: string,
  providedPassword?: string,
  roleToAssign?: string
) {
  const updateData: any = {
    status: newStatus,
  };

  if (newStatus === 'ACCEPTED') {
    updateData.approvedAt = new Date();

    // Try to find the correct Admin ID to satisfy the foreign key constraint
    // The adminId passed is likely the User.id
    try {
      const user = await dbClient.db.query.Users.findFirst({
        where: eq(schema.Users.id, adminId),
        columns: { constituentId: true }
      });

      if (user) {
        const admin = await dbClient.db.query.Admins.findFirst({
          where: eq(schema.Admins.constituentId, user.constituentId),
          columns: { id: true }
        });

        if (admin) {
          updateData.approvedBy = admin.id;
        } else {
          // If no linked Admin record exists, we can't set approvedBy due to FK constraint
          // We set it to null rather than failing the entire request
          console.warn(`No Admin record found for User ${adminId} (Constituent ${user.constituentId}). approvedBy will be null.`);
          updateData.approvedBy = null;
        }
      } else {
        // Fallback if user not found (unlikely)
        updateData.approvedBy = null;
      }
    } catch (error) {
      console.error("Error resolving Admin ID:", error);
      updateData.approvedBy = null;
    }

  } else if (newStatus === 'REJECTED') {
    updateData.declinedReason = declinedReason || null;
  }

  const [updated] = await dbClient.db
    .update(schema.Applications)
    .set(updateData)
    .where(eq(schema.Applications.id, id))
    .returning();

  if (!updated) throw new ApiError("Application not found", 404);

  // If approved, create user account and member record
  if (newStatus === 'ACCEPTED') {
    const application = await getApplicationById(id);
    if (!application) throw new ApiError("Application not found", 404);

    // Import required services and utilities
    const { createUser } = await import('./usersService');
    const { enrollGlobal } = await import('./membersService');
    const { sendWelcomeEmail } = await import('../utils/email');
    const { generatePassword, generateMemberId } = await import('../utils/credentials');

    // Generate credentials if not provided
    console.log(`Service: updateApplicationStatus for ${id}. providedMemberId: ${providedMemberId}, providedPassword: ${providedPassword ? "EXISTS" : "MISSING"}`);
    const memberId = providedMemberId || generateMemberId();
    const password = providedPassword || generatePassword();
    console.log(`Service: Final credentials for ${id} - memberId: ${memberId}, password: ${password}. (Generated: ${!providedPassword})`);

    // Create user account
    const user = await createUser({
      email: application.applicant.email!,
      password,
      username: memberId,
      constituentId: application.applicant.id,
    });

    // Create member record
    const memberRecordId = await enrollGlobal(application.applicant.id);

    // TODO: Assign specific role if needed (requires mapping role strings to titleIds)
    // For now, all approved members get general_member role by default
    // if (roleToAssign !== 'general_member') {
    //   await assignRole(application.constituentId, titleIdForRole);
    // }

    // Send welcome email with credentials
    await sendWelcomeEmail({
      email: application.applicant.email,
      firstName: application.applicant.firstName,
      lastName: application.applicant.lastName,
      memberId,
      password,
      role: roleToAssign || 'general_member',
    });

    // Return the credentials so frontend can display them
    return {
      ...updated,
      credentials: {
        memberId,
        password,
        role: roleToAssign,
      },
    };
  }

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
