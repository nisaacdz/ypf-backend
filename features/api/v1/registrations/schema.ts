import { z } from "zod";

export const createRegistrationSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(1),
  whatsappNumber: z.string().optional(),
  dateOfBirth: z.string().optional(), // Expecting ISO date string
  gender: z.string().optional(),
  occupation: z.string().optional(),
  country: z.string().min(1),
  region: z.string().optional(),
  city: z.string().optional(),
  chapterId: z.string().uuid().optional(),
  campus: z.string().optional(),
  nationalIdNumber: z.string().optional(),
  passportPhotoId: z.string().uuid().optional(),
  ghanaCardFrontId: z.string().uuid().optional(),
  ghanaCardBackId: z.string().uuid().optional(),
  membershipStatus: z.enum(['executive', 'general', 'honorary', 'new']),
  missionPillars: z.array(z.string()).optional(),
  referralSource: z.string().optional(),
  referralOther: z.string().optional(),
  commitmentStatement: z.string().optional(),
  willingToServe: z.enum(['yes', 'maybe', 'no']).optional(),
  preferredRole: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  emergencyContactRelationship: z.string().optional(),
  skills: z.array(z.string()).optional(),
  previousVolunteerExperience: z.string().optional(),
  linkedinProfile: z.string().optional(),
  twitterHandle: z.string().optional(),
  agreeToTerms: z.boolean().optional(),
  agreeToPrivacy: z.boolean().optional(),
  declarationConsent: z.boolean().optional(),
});

export const updateRegistrationStatusSchema = z.object({
  status: z.enum(['approved', 'declined']),
  declinedReason: z.string().optional(),
  assignedRole: z.string().optional(),
});

export type CreateRegistrationInput = z.infer<typeof createRegistrationSchema>;
export type UpdateRegistrationStatusInput = z.infer<typeof updateRegistrationStatusSchema>;
