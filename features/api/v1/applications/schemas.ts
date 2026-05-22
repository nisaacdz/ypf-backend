import {
  ApplicationStatusEnum,
  GenderEnum,
  NationalIdTypeEnum,
} from "@/db/schema/core";
import { z } from "zod";
import { AllowedDocumentsMimeTypes } from "@/shared/middlewares/multipart";

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

// Mission pillars use stable string-enum values (plan §11 #6). New pillars
// added later just extend this list.
export const MissionPillarValues = [
  "COMMUNITY_IMPACT",
  "MENTORSHIP_NETWORKING",
  "ADVOCACY_AWARENESS",
] as const;

const ConsentsObject = z
  .object({
    termsAgreedAt: z.string().datetime().optional(),
    privacyAgreedAt: z.string().datetime().optional(),
    declarationAgreedAt: z.string().datetime().optional(),
  })
  .strict();

// Multipart submissions can't carry nested JSON, so the client stringifies the
// consents object before append-ing. JSON callers can still send it as an
// object directly.
const ConsentsSchema = z.preprocess((val) => {
  if (typeof val === "string" && val.trim().length > 0) {
    try {
      return JSON.parse(val);
    } catch {
      return val; // let the inner schema fail with a clear error
    }
  }
  return val;
}, ConsentsObject);

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
  missionPillars: z.array(z.enum(MissionPillarValues)).optional(),
  referralSource: z.string().optional(),
  // referralOther: z.string().optional(),
  previousVolunteerExperience: z.string().optional(),
  // Application specific
  commitmentStatement: z.string(),
  preferredChapterId: z.uuid().optional(),
  preferredCommitteeId: z.uuid().optional(),
  willingToServe: z.coerce.boolean().refine((val) => val === true, {
    message: "You must agree to be willing to serve.",
  }),
  consents: ConsentsSchema.optional(),
});

export const PostMembershipApplicationBody = FlatApplicationInput.transform(
  (data) => {
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
      missionPillars,
      previousVolunteerExperience,
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
        missionPillars,
        previousVolunteerExperience,
      },
      ...rest,
    };
  },
);

export const UpdateMembershipApplicationStatusSchema = z
  .object({
    status: z.enum(ApplicationStatusEnum.enumValues),
  })
  .or(
    z.object({
      status: "REJECTED" as const,
      declinedReason: z.string().optional(),
    }),
  );

export const GetMembershipApplicationsQuerySchema = z.object({
  page: z.coerce.number().default(1),
  pageSize: z.coerce.number().default(10),
  status: z.enum(ApplicationStatusEnum.enumValues).optional(),
  search: z.string().optional(),
});

// Volunteer Application Schemas

const FlatVolunteerApplicationInput = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.email(),
  phone: z.string().min(1),
  whatsapp: z.string().optional(),
  country: z.string().optional(),
  region: z.string().optional(),
  city: z.string().optional(),
  occupation: z.string().optional(),
  skills: z.array(z.string()).optional(),
  reason: z
    .string()
    .min(10, "Please provide a reason for volunteering (min 10 chars)."),
  experience: z.string().max(2000).optional(),
  availability: z
    .enum(["WEEKDAYS", "WEEKENDS", "BOTH", "FLEXIBLE"])
    .optional(),
  consents: ConsentsSchema.optional(),
});

export const PostVolunteerApplicationBody =
  FlatVolunteerApplicationInput.transform((data) => {
    const {
      firstName,
      lastName,
      email,
      phone,
      whatsapp,
      country,
      region,
      city,
      occupation,
      skills,
      ...rest
    } = data;

    return {
      applicantData: {
        firstName,
        lastName,
        email,
        phone,
        whatsapp,
        country,
        region,
        city,
        occupation,
        skills,
      },
      ...rest,
    };
  });

export const GetVolunteerApplicationsQuerySchema = z.object({
  page: z.coerce.number().default(1),
  pageSize: z.coerce.number().default(10),
  status: z.enum(ApplicationStatusEnum.enumValues).optional(),
  search: z.string().optional(),
});

export const UpdateVolunteerApplicationStatusSchema = z.object({
  status: z.enum(ApplicationStatusEnum.enumValues),
  notes: z.string().optional(),
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
