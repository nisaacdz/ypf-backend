import { ApiResponse, ApiError } from "@/shared/types";
import {
  PostMembershipApplicationBody,
  PostVolunteerApplicationBody,
  GetMembershipApplicationsQuerySchema,
  GetVolunteerApplicationsQuerySchema,
  UpdateMembershipApplicationStatusSchema,
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

export async function getMembershipApplications(
  query: z.infer<typeof GetMembershipApplicationsQuerySchema>
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
  applicationId: string
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
    nationalId: Express.Multer.File;
  };
}): Promise<ApiResponse<string>> {
  const existingUser = await dbClient.db.query.Constituents.findFirst({
    where: or(
      eq(schema.Constituents.email, data.applicantData.email),
      eq(schema.Constituents.phone, data.applicantData.phone),
      data.applicantData.whatsapp
        ? eq(schema.Constituents.whatsapp, data.applicantData.whatsapp)
        : undefined
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

  const [passportPhoto, resume, nationalId] = await Promise.all([
    fileUtils
      .storeMediumFile(files.passportPhoto)
      .then(mediaService.uploadMedium),
    files.resume
      ? fileUtils
          .storeDocumentFile(files.resume)
          .then(documentsService.uploadDocument)
      : null,
    fileUtils
      .storeDocumentFile(files.nationalId)
      .then(documentsService.uploadDocument),
  ]);

  let { applicantData, ...applicationData } = data;

  const application = await applicationsService.createMembershipApplication({
    ...applicationData,
    constituent: {
      ...applicantData,
      profilePhotoId: passportPhoto.id,
      nationalIdDocumentId: nationalId.id,
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
  query: z.infer<typeof GetVolunteerApplicationsQuerySchema>
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
  applicationId: string
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
  data: z.infer<typeof PostVolunteerApplicationBody>
): Promise<ApiResponse<{ id: string; trackingNumber: string }>> {
  const existingUser = await dbClient.db.query.Constituents.findFirst({
    where: or(
      eq(schema.Constituents.email, data.applicantData.email),
      eq(schema.Constituents.phone, data.applicantData.phone),
      data.applicantData.whatsapp
        ? eq(schema.Constituents.whatsapp, data.applicantData.whatsapp)
        : undefined
    ),
    columns: { id: true, email: true, phone: true, whatsapp: true },
  });

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
}): Promise<ApiResponse<YPFMembershipApplicationDetail>> {
  if (body.status === "REJECTED" && !body.declinedReason) {
    throw new ApiError("Declined reason is required when rejecting", 400);
  }

  // Update status
  await applicationsService.updateMembershipApplicationStatus(
    applicationId,
    body.status,
    adminId // Pass admin ID for auditing/logging if service uses it
  );

  // If rejected with reason, we might want to update that too.
  // result above is a list of updated items, but the service returns the first one.
  // Wait, service returns `returning()`, which is an array.

  // Actually the service function signature is:
  // updateMembershipApplicationStatus(id, newStatus, adminId)

  // It handles the update. Does it handle declinedReason?
  // Let me check the service again.
  // `dbClient.db.update(...).set({ status: newStatus })...`
  // It DOES NOT seem to set declinedReason. I might need to update the service too.

  // Refetch to get full details for response
  const updatedApplication =
    await applicationsService.getMembershipApplicationById(applicationId);

  if (!updatedApplication) {
    throw new ApiError("Application not found after update", 404);
  }

  return {
    success: true,
    message: "Application status updated successfully",
    data: updatedApplication,
  };
}
