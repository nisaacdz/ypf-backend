import { Request, Response, NextFunction } from "express";
import { loginUser } from "./auth.service";
import { encodeData } from "../../shared/utils/jwt";
import { AppError } from "../../shared/types";
import { success } from "zod";

export async function naiveLogin(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      throw new AppError("Username and password are required", 400);
    }

    const authenticatedUser = await loginUser(username, password);

    const token = encodeData(authenticatedUser);

    res.cookie("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: "/",
    });

    res.status(200).json({
      success: true,
      data: authenticatedUser,
    });
  } catch (error) {
    next(error);
  }
}
