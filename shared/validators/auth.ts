import variables from "@/configs/env";
import z from "zod";
import { Profiles } from "../types";

export const AuthenticatedUserSchema = z.object({
  id: z.uuid({ message: "Invalid user ID format." }),
  constituentId: z.string({ message: "Constituent ID is required." }),
  email: z.email({ message: "Please enter a valid email address." }),
  fullName: z.string({ message: "Full name is required." }),
  roles: z.array(z.string(), { message: "Roles must be an array of strings." }), //eg 'ADMIN.REGULAR', 'MEMBER.president', 'MEMBER.chair.<committee_id>' etc
  profiles: z
    .array(z.enum(Profiles), {
      message: "Profiles must be an array.",
    })
    .max(Profiles.length, {
      message: `You can have at most ${Profiles.length} active profiles.`,
    }),
});

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

export const RefreshTokenPayloadSchema = z.object({
  username: z.string({ message: "Username is required." }),
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
