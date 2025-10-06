import { NextFunction, Request, Response } from "express";
import { AppError } from "../types";
import { decodeData } from "../utils/jwt";
import { AuthenticatedUserSchema } from "../validators";
import authorizer from "@/configs/authorizer";

export function authenticate(req: Request, res: Response, next: NextFunction) {
  if (req.User) {
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

  req.User = decodedUser;

  next();
}

export const authorize = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const user = req.User;
  if (!user) {
    return next(new AppError("Authentication required.", 401));
  }

  const resource = req.path.match(/^\/api(?:\/v\d+)?(\/.*)?$/)?.[1] ?? "/";
  const action = req.method;

  try {
    const hasPermission = await authorizer.enforce(user, resource, action);

    if (hasPermission) {
      return next();
    }

    return res
      .status(403)
      .json({ success: false, message: "Permission denied!" });
  } catch (error) {
    return next(error);
  }
};
