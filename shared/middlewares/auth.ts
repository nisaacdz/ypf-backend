import { NextFunction, Request, Response } from "express";
import { AppError } from "../types";
import { decodeData } from "../utils/jwt";
import { AuthenticatedUserSchema } from "../validators";
import authorizer from "@/configs/authorizer";

export function authenticate(req: Request, res: Response, next: NextFunction) {
  if (req.user) {
    return next();
  }

  const token = req.cookies.auth_token;

  if (!token) {
    return next(
      new AppError("You are not logged in. Please log in to get access.", 401),
    );
  }

  const decodedUser = decodeData(token, AuthenticatedUserSchema);

  if (!decodedUser) {
    return next(new AppError("Invalid token. Please log in again.", 401));
  }

  req.user = decodedUser;

  next();
}

export const authorize = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const user = req.user;
  if (!user) {
    return next(new AppError("Authentication required.", 401));
  }

  const resource = req.path.replace("/api/v1", "") || "/";
  const action = req.method;

  try {
    const hasPermission = await authorizer.enforce(user, resource, action);

    if (hasPermission) {
      return next(); // User is authorized, proceed to the handler
    }

    return next(
      new AppError("You do not have permission to perform this action.", 403),
    );
  } catch (error) {
    // Catch initialization errors or other issues
    return next(error);
  }
};
