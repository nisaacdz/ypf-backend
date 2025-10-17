/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response, NextFunction } from "express";
import { AppError } from "../types";

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction,
) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      data: undefined,
      message: err.message,
    });
  }

  console.error(err.stack);

  return res.status(500).json({
    success: false,
    message: "An unexpected error occurred.",
  });
};
