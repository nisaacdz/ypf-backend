import { NextFunction, Request, Response } from "express";
import { AppError } from "../types";
import policyConfig from "@/configs/policy";

export async function authorize(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (!req.user) {
    return next(new AppError("User not authenticated", 401));
  }

  const isAuthorized = await policyConfig.enforce(
    req.user,
    req.path,
    req.method, // todo
  );

  if (!isAuthorized) {
    return next(new AppError("User not authorized", 403));
  }

  next();
}
