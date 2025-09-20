import variables from "@/configs/env";
import { MembershipType } from "@/db/schema/enums";
import z from "zod";

export const AuthenticatedUserSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  fullName: z.string(),
  roles: z.array(z.string().min(1)), // active roles
  memberships: z
    .array(z.enum(MembershipType.enumValues))
    .max(MembershipType.enumValues.length), // active memberships
});

export const CreateEventSchema = z.object({
  projectId: z.uuid().optional(),
  eventName: z.string().min(2).max(100),
  eventDate: z.date(),
  eventLocation: z.string().max(255).optional(),
  eventObjectives: z.string().max(1000).optional(),
  status: z.enum(["UPCOMING", "COMPLETED", "CANCELLED"]).optional(),
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

export type AuthenticatedUser = z.infer<typeof AuthenticatedUserSchema>;
