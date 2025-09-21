/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-namespace */
import { AuthenticatedUser } from "../validators";
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
      user?: AuthenticatedUser;
      Body: any;
      Query: any;
    }
  }
}

export type MembershipType = (typeof MembershipTypeEnum.enumValues)[number];
