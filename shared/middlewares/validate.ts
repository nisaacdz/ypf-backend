import { NextFunction, Request, Response } from "express";
import { AppError } from "../types";
import z from "zod";

export function validateBody<T>(schema: z.ZodType<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      return next(new AppError(result.error.message, 400));
    }

    req.Body = result.data;

    return next();
  };
}

export function validateQuery<T>(schema: z.ZodType<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);

    if (!result.success) {
      return next(new AppError(result.error.message, 400));
    }

    req.Query = result.data;

    return next();
  };
}
