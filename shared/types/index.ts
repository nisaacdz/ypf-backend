import z from "zod";
import { AuthenticatedUserSchema } from "../validators";
export * from "./api";

export type AuthenticatedUser = z.infer<typeof AuthenticatedUserSchema>;
export const Profiles = [
  "ADMIN",
  "MEMBER",
  "VOLUNTEER",
  "AUDITOR",
  "DIRECTOR",
] as const;
export type Profile = (typeof Profiles)[number];
