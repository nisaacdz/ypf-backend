/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-namespace */
import z from "zod";
import { AuthenticatedUserSchema } from "../validators";
import { MembershipType as MembershipTypeEnum } from "@/db/schema/enums";

export class AppError extends Error {
  public statusCode: number;

  constructor(message: string, status: number = 500) {
    super(message);
    this.statusCode = status;
    this.name = "AppError";
  }
}

export type ApiResponse<T> = {
  success: boolean;
  data: T;
  message?: string;
};

declare global {
  namespace Express {
    interface Request {
      User?: AuthenticatedUser;
      Body: any;
      Query: any;
    }
  }
}

export type MembershipType = (typeof MembershipTypeEnum.enumValues)[number];
export type AuthenticatedUser = z.infer<typeof AuthenticatedUserSchema>;
