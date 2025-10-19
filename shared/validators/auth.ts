import variables from "@/configs/env";
import { MembershipType } from "@/db/schema/enums";
import z from "zod";

export const AuthenticatedUserSchema = z.object({
  id: z.uuid(),
  constituentId: z.string(),
  email: z.email(),
  fullName: z.string(),
  roles: z.array(
    z.object({
      name: z.string(),
      scope: z.string(),
    }),
  ),
  memberships: z
    .array(z.enum(MembershipType.enumValues))
    .max(MembershipType.enumValues.length), // active memberships
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
        return variables.allowedOrigins.includes(url.origin);
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
