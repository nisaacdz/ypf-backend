import { ApiResponse, ApiError } from "@/shared/types";
import {
  PostMembershipApplicationBody,
  PostVolunteerApplicationBody,
  GetMembershipApplicationsQuerySchema,
  GetVolunteerApplicationsQuerySchema,
  UpdateMembershipApplicationStatusSchema,
  UpdateVolunteerApplicationStatusSchema,
} from "./schemas";
import z from "zod";
import * as applicationsService from "@/shared/services/applicationsService";
import * as fileUtils from "@/shared/utils/files";
import { Paginated } from "@/shared/dtos";
import {
  YPFMembershipApplication,
  YPFMembershipApplicationDetail,
  YPFVolunteerApplication,
  YPFVolunteerApplicationDetail,
} from "./dtos";
import * as documentsService from "@/shared/services/documentsService";
import * as mediaService from "@/shared/services/mediaService";
import dbClient from "@/configs/db";
import schema from "@/db/schema";
import { eq, or } from "drizzle-orm";
import { MembershipApplicationStatus } from "@/shared/utils";

export async function getMembershipApplications(
  query: z.infer<typeof GetMembershipApplicationsQuerySchema>,
): Promise<ApiResponse<Paginated<YPFMembershipApplication>>> {
  const result = await applicationsService.getMembershipApplications(query);

  return {
    success: true,
    message: "Applications fetched successfully",
    data: {
      items: result.items,
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
    },
  };
}

export async function getMembershipApplicationById(
  applicationId: string,
): Promise<ApiResponse<YPFMembershipApplicationDetail>> {
  const application =
    await applicationsService.getMembershipApplicationById(applicationId);

  if (!application) {
    throw new ApiError("Application not found", 404);
  }

  return {
    success: true,
    message: "Application fetched successfully",
    data: application,
  };
}

export async function createMembershipApplication({
  data,
  files,
}: {
  data: z.infer<typeof PostMembershipApplicationBody>;
  files: {
    passportPhoto: Express.Multer.File;
    resume: Express.Multer.File | null;
    nationalId: Express.Multer.File | null;
  };
}): Promise<ApiResponse<string>> {
  // Runs before the uploads so an ineligible applicant doesn't leave orphan
  // blobs behind. Being an existing constituent is fine — only an active
  // membership or an application already in review stops them here.
  await applicationsService.assertCanApplyForMembership({
    email: data.applicantData.email,
  });

  const [passportPhoto, resume, nationalId] = await Promise.all([
    fileUtils
      .storeMediumFile(files.passportPhoto)
      .then(mediaService.uploadMedium),
    files.resume
      ? fileUtils
          .storeDocumentFile(files.resume)
          .then(documentsService.uploadDocument)
      : null,
    files.nationalId
      ? fileUtils
          .storeDocumentFile(files.nationalId)
          .then(documentsService.uploadDocument)
      : null,
  ]);

  let { applicantData, ...applicationData } = data;

  const application = await applicationsService.createMembershipApplication({
    ...applicationData,
    constituent: {
      ...applicantData,
      profilePhotoId: passportPhoto.id,
      nationalIdDocumentId: nationalId?.id,
    },
    cvDocumentId: resume?.id,
    willingToServe: applicationData.willingToServe,
  });

  return {
    success: true,
    message: "Application submitted successfully",
    data: application.id,
  };
}

export async function getVolunteerApplications(
  query: z.infer<typeof GetVolunteerApplicationsQuerySchema>,
): Promise<ApiResponse<Paginated<YPFVolunteerApplication>>> {
  const result = await applicationsService.getVolunteerApplications(query);

  return {
    success: true,
    message: "Volunteer applications fetched successfully",
    data: {
      items: result.items,
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
    },
  };
}

export async function getVolunteerApplicationById(
  applicationId: string,
): Promise<ApiResponse<YPFVolunteerApplicationDetail>> {
  const application =
    await applicationsService.getVolunteerApplicationById(applicationId);

  if (!application) {
    throw new ApiError("Application not found", 404);
  }

  return {
    success: true,
    message: "Volunteer application fetched successfully",
    data: application,
  };
}

export async function createVolunteerApplication(
  data: z.infer<typeof PostVolunteerApplicationBody>,
): Promise<ApiResponse<{ id: string; trackingNumber: string }>> {
  const existingUser = await dbClient.db.query.Constituents.findFirst({
    where: or(
      eq(schema.Constituents.email, data.applicantData.email),
      eq(schema.Constituents.phone, data.applicantData.phone),
      data.applicantData.whatsapp
        ? eq(schema.Constituents.whatsapp, data.applicantData.whatsapp)
        : undefined,
    ),
    columns: { id: true, email: true, phone: true, whatsapp: true },
  });

  if (existingUser) {
    if (existingUser.email === data.applicantData.email)
      throw new ApiError("Email already exists", 400);
    if (existingUser.phone === data.applicantData.phone)
      throw new ApiError("Phone already exists", 400);
    if (existingUser.whatsapp === data.applicantData.whatsapp)
      throw new ApiError("WhatsApp already exists", 400);
  }

  const application = await applicationsService.createVolunteerApplication({
    ...data,
    constituent: {
      ...data.applicantData,
    },
  });

  return {
    success: true,
    message: "Volunteer application submitted successfully",
    data: {
      id: application.id,
      trackingNumber: application.trackingNumber,
    },
  };
}

export async function updateMembershipApplicationStatus({
  applicationId,
  body,
  adminId,
}: {
  applicationId: string;
  body: z.infer<typeof UpdateMembershipApplicationStatusSchema>;
  adminId: string;
}): Promise<ApiResponse<null>> {
  const { status, declinedReason } = body as {
    status: MembershipApplicationStatus;
    declinedReason?: string;
  };

  await applicationsService.updateMembershipApplicationStatus(
    applicationId,
    status,
    adminId,
    declinedReason,
  );

  return {
    success: true,
    message: "Application status updated successfully",
    data: null,
  };
}

export async function updateVolunteerApplicationStatus({
  applicationId,
  body,
}: {
  applicationId: string;
  body: z.infer<typeof UpdateVolunteerApplicationStatusSchema>;
}): Promise<ApiResponse<null>> {
  await applicationsService.updateVolunteerApplicationStatus(
    applicationId,
    body.status,
    body.notes,
  );

  return {
    success: true,
    message: "Volunteer application status updated successfully",
    data: null,
  };
}
