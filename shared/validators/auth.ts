import variables from "@/configs/env";
import z from "zod";

export const AuthenticatedUserSchema = z.object({
  id: z.uuid(),
  constituentId: z.string(),
  email: z.email(),
  fullName: z.string(),
  roles: z.array(z.string()), //eg 'ADMIN.REGULAR', 'MEMBER.president', 'MEMBER.chair.<committee_id>' etc
  profiles: z
    .array(z.enum(["ADMIN", "MEMBER", "VOLUNTEER", "DONOR", "AUDITOR"]))
    .max(5), // active profiles
});

export const UsernameAndPasswordSchema = z.object({
  username: z.string(),
  password: z.string().min(4).max(55),
});

export const AuthCodeSchema = z.object({
  code: z.string(),
  codeVerifier: z.string(),
  redirectUri: z.url().refine(
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
  otp: z.string().min(6).max(6),
});

export const RefreshTokenPayloadSchema = z.object({
  username: z.string(),
});

export const ForgotPasswordSchema = z.object({
  email: z.email(),
});

export const ResetPasswordSchema = z.object({
  email: z.email(),
  otp: z.string().min(6).max(6),
  password: z.string().min(4).max(55),
});
