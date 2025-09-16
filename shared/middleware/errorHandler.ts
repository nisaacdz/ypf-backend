import { Request, Response, NextFunction } from "express";
import { AppError } from "../types";

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  console.error(err.stack);

  if (err instanceof AppError) {
    return res
      .status(err.statusCode)
      .json({ error: err.message });
  }

  res.status(500).json({
    error: "Internal Server Error",
    status: 500,
  });

  next();
};
