import {
  ApplicationStatusEnum,
  GenderEnum,
  NationalIdTypeEnum,
} from "@/db/schema/core";
import { z } from "zod";
import { Profiles } from "../../../../shared/types";
import { AllowedDocumentsMimeTypes } from "../../../../shared/middlewares/multipart";

const ApplicantData = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  preferredName: z.string().optional(),
  email: z.email(),
  phone: z.string().min(1),
  whatsapp: z.string().optional(),
  // salutation: z.string().optional(),
  dateOfBirth: z.coerce.date(),
  gender: z.enum(GenderEnum.enumValues).optional(),
  occupation: z.string().optional(),
  country: z.string().optional(),
  region: z.string().optional(),
  city: z.string().optional(),
  campus: z.string().optional(),
  nationalIdType: z.enum(NationalIdTypeEnum.enumValues),
  // referralOther: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  // emergencyContactRelationship: z.string().optional(),
  skills: z.array(z.string()).optional(),
  linkedinProfile: z.string().optional(),
  twitterHandle: z.string().optional(),
});

// Define the flat input schema
const FlatApplicationInput = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  preferredName: z.string().optional(),
  email: z.email(),
  phone: z.string().min(1),
  whatsapp: z.string().optional(),
  // salutation: z.string().optional(),
  dateOfBirth: z.coerce.date(),
  gender: z.enum(GenderEnum.enumValues).optional(),
  occupation: z.string().optional(),
  country: z.string().optional(),
  region: z.string().optional(),
  city: z.string().optional(),
  campus: z.string().optional(),
  nationalIdType: z.enum(NationalIdTypeEnum.enumValues),
  // referralOther: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  // emergencyContactRelationship: z.string().optional(),
  skills: z.array(z.string()).optional(), // Note: validation of array format in multipart might need handle json parsing if sent as string, but assuming middleware handles it or client sends duplicates
  linkedinProfile: z.string().optional(),
  twitterHandle: z.string().optional(),

  // Profile fields
  //missionPillars: z.array(z.string()).optional(),
  referralSource: z.string().optional(),
  // referralOther: z.string().optional(),
  previousVolunteerExperience: z.string().optional(),
  // Application specific
  commitmentStatement: z.string(),
  preferredChapterId: z.string().uuid().optional(), // Changed to string().uuid() for simpler multipart handling
  preferredCommitteeId: z.string().uuid().optional(),
  preferredProfile: z.enum(Profiles).default("MEMBER"),
  willingToServe: z.coerce.boolean().refine((val) => val === true, {
    message: "You must agree to be willing to serve.",
  }),
});

export const PostApplicationBody = FlatApplicationInput.transform((data) => {
  const {
    firstName,
    lastName,
    preferredName,
    email,
    phone,
    whatsapp,
    dateOfBirth,
    gender,
    occupation,
    country,
    region,
    city,
    campus,
    nationalIdType,
    emergencyContactName,
    emergencyContactPhone,
    skills,
    linkedinProfile,
    twitterHandle,
    ...rest
  } = data;

  return {
    applicantData: {
      firstName,
      lastName,
      preferredName,
      email,
      phone,
      whatsapp,
      dateOfBirth,
      gender,
      occupation,
      country,
      region,
      city,
      campus,
      nationalIdType,
      emergencyContactName,
      emergencyContactPhone,
      skills,
      linkedinProfile,
      twitterHandle,
    },
    ...rest,
  };
});

export const UpdateApplicationStatusSchema = z
  .object({
    status: z.enum(ApplicationStatusEnum.enumValues),
  })
  .or(
    z.object({
      status: "REJECTED" as const,
      declinedReason: z.string().optional(),
    })
  );

export const GetApplicationsQuerySchema = z.object({
  page: z.coerce.number().default(1),
  pageSize: z.coerce.number().default(10),
  status: z.string().optional(),
  search: z.string().optional(),
});

export const UploadRegistrationFileSchema = z.object({
  size: z
    .number()
    .max(5 * 1024 * 1024)
    .positive({ message: "File size must be a positive number." }),
  mimeType: z.enum(Object.keys(AllowedDocumentsMimeTypes), {
    error: () => ({
      message: "Invalid file type. Only PNG, JPG, MP4, or AVI are allowed.",
    }),
  }),
});
