import { NextFunction, Request, Response } from "express";
import { AppError } from "../types";
import { decodeToken } from "../utils/jwt";
import { AuthenticatedUserSchema } from "../validators";
import type { GuardFunction } from "@/configs/authorizer";

export function authenticate(req: Request, res: Response, next: NextFunction) {
  if (req.User) {
    return next();
  }

  const token = req.cookies.access_token;

  if (!token) {
    return next(
      new AppError("You are not logged in. Please log in to get access.", 401),
    );
  }

  const decodedUser = decodeToken(token, AuthenticatedUserSchema);

  if (!decodedUser) {
    return next(new AppError("Invalid token. Please log in again.", 401));
  }

  if ("id" in decodedUser) {
    // Valid token with user data
    req.User = decodedUser;
    return next();
  }

  // Expired token
  return next(new AppError("Your session has expired. Please log in again.", 401));
}

export const authorize = (guard: GuardFunction) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const hasAccess = await guard(req);

      if (hasAccess) {
        return next();
      }

      return res.status(403).json({
        success: false,
        message: "You don't have permission to access this resource",
      });
    } catch (error) {
      return next(error);
    }
  };
};

export const authenticateLax = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const token = req.cookies.access_token;

  if (!token) {
    return next();
  }

  const decodedUser = decodeToken(token, AuthenticatedUserSchema);

  if (decodedUser && "id" in decodedUser) {
    // Only set user if token is valid and not expired
    req.User = decodedUser;
  }

  next();
};
