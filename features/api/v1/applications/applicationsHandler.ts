import { ApiResponse, ApiError } from "@/shared/types";
import { PostApplicationBody, GetApplicationsQuerySchema } from "./schemas";
import z from "zod";
import * as applicationsService from "@/shared/services/applicationsService";
import * as fileUtils from "@/shared/utils/files";
import { Paginated } from "@/shared/dtos";
import { YPFApplication, YPFApplicationDetail } from "./dtos";
import * as documentsService from "@/shared/services/documentsService";
import * as mediaService from "@/shared/services/mediaService";
import dbClient from "@/configs/db";
import schema from "@/db/schema";
import { eq, or } from "drizzle-orm";

export async function getApplications(
  query: z.infer<typeof GetApplicationsQuerySchema>
): Promise<ApiResponse<Paginated<YPFApplication>>> {
  const result = await applicationsService.getApplications(query);

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

export async function getApplicationById(
  applicationId: string
): Promise<ApiResponse<YPFApplicationDetail>> {
  const application =
    await applicationsService.getApplicationById(applicationId);

  if (!application) {
    throw new ApiError("Application not found", 404);
  }

  return {
    success: true,
    message: "Application fetched successfully",
    data: application,
  };
}

export async function createApplication({
  data,
  files,
}: {
  data: z.infer<typeof PostApplicationBody>;
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

  const application = await applicationsService.createApplication({
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
