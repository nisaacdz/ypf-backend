import variables from "@/configs/env";
import z from "zod";

export const UsernameAndPasswordSchema = z.object({
  username: z.string({ message: "Username is required." }),
  password: z
    .string({ message: "Password is required." })
    .min(4, { message: "Password must be at least 4 characters." })
    .max(55, { message: "Password must not exceed 55 characters." }),
});

export const AuthCodeSchema = z.object({
  code: z.string({ message: "Authorization code is required." }),
  codeVerifier: z.string({ message: "Code verifier is required." }),
  redirectUri: z.url({ message: "Please enter a valid redirect URL." }).refine(
    (uri) => {
      try {
        const url = new URL(uri);
        return variables.security.allowedOrigins.includes(url.origin);
      } catch {
        return false;
      }
    },
    {
      message: "The redirect URI is not from an allowed origin.",
    },
  ),
});

export const OtpSchema = z.object({
  otp: z
    .string({ message: "OTP is required." })
    .min(6, { message: "OTP must be exactly 6 characters." })
    .max(6, { message: "OTP must be exactly 6 characters." }),
});

export const ForgotPasswordSchema = z.object({
  email: z.email({ message: "Please enter a valid email address." }),
});

export const ResetPasswordSchema = z.object({
  email: z.email({ message: "Please enter a valid email address." }),
  otp: z
    .string({ message: "OTP is required." })
    .min(6, { message: "OTP must be exactly 6 characters." })
    .max(6, { message: "OTP must be exactly 6 characters." }),
  password: z
    .string({ message: "Password is required." })
    .min(4, { message: "Password must be at least 4 characters." })
    .max(55, { message: "Password must not exceed 55 characters." }),
});

export const UpdateMeSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  preferredName: z.string().max(150).nullable().optional(),
  email: z.email().nullable().optional(),
  phone: z.string().max(40).nullable().optional(),
  whatsapp: z.string().max(40).nullable().optional(),
  country: z.string().max(100).nullable().optional(),
  region: z.string().max(100).nullable().optional(),
  city: z.string().max(100).nullable().optional(),
  campus: z.string().max(150).nullable().optional(),
  occupation: z.string().max(150).nullable().optional(),
  linkedinProfile: z.string().max(255).nullable().optional(),
  twitterHandle: z.string().max(120).nullable().optional(),
  skills: z.array(z.string().min(1).max(80)).max(30).optional(),
  previousVolunteerExperience: z.string().max(2000).nullable().optional(),
});

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, { message: "Current password is required." }),
  newPassword: z
    .string({ message: "New password is required." })
    .min(8, { message: "Password must be at least 8 characters." })
    .max(55, { message: "Password must not exceed 55 characters." }),
});

export const UploadProfilePhotoSchema = z.object({
  size: z
    .number()
    .positive({ message: "File size must be a positive number." })
    .max(5 * 1024 * 1024, { message: "Profile photo cannot exceed 5MB." }),
  mimeType: z.enum(["image/png", "image/jpeg"], {
    error: () => ({
      message: "Invalid file type. Only PNG or JPG images are allowed.",
    }),
  }),
});

export const OnboardSchema = z.object({
  user: z
    .string({ message: "User ID is required." })
    .regex(/^YPF-\d{4}-[A-Za-z0-9]{6}$/, {
      message:
        "User ID must match the format 'YPF-YYYY-XXXXXX' (e.g., 'YPF-2024-ABC123').",
    }),
});

// Plan §I9 — public endpoint, must reject fuzzed input at the middleware
// boundary rather than letting it through to a DB query.
export const OnboardStatusQuerySchema = z.object({
  user: z
    .string()
    .regex(/^YPF-\d{4}-[A-Za-z0-9]{6}$/, {
      message: "Invalid user identifier.",
    }),
});
