/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-namespace */
import z from "zod";
import { AuthenticatedUserSchema } from "../validators";
export * from "./api";

declare global {
  namespace Express {
    interface Request {
      User?: AuthenticatedUser;
      Body: any;
      Query: any;
      Params: any;
      File: any;
    }
  }
}

export type AuthenticatedUser = z.infer<typeof AuthenticatedUserSchema>;
