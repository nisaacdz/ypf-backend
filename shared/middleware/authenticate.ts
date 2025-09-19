import { NextFunction, Request, Response } from "express";
import { AppError } from "../types";
import { decodeData } from "../utils/jwt";
import { AuthTokenValidationSchema } from "../validators";

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

  const decodedUser = decodeData(token, AuthTokenValidationSchema);

  if (!decodedUser) {
    return next(new AppError("Invalid token. Please log in again.", 401));
  }

  req.user = decodedUser;

  next();
}
