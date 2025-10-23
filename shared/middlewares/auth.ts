import { NextFunction, Request, Response } from "express";
import { AppError } from "../types";
import { decodeData, encodeData } from "../utils/jwt";
import {
  AuthenticatedUserSchema,
  RefreshTokenPayloadSchema,
} from "../validators";
import type { GuardFunction } from "@/configs/authorizer";
import * as authService from "../services/authService";

export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (req.User) {
    return next();
  }

  const accessToken = req.cookies.access_token;
  const refreshToken = req.cookies.refresh_token;

  if (!accessToken) {
    return next(
      new AppError("You are not logged in. Please log in to get access.", 401),
    );
  }

  const accessTokenDecodeResult = decodeData(
    accessToken,
    AuthenticatedUserSchema,
  );

  if (!accessTokenDecodeResult) {
    return next(new AppError("Invalid token. Please log in again.", 401));
  }

  if ("valid" in accessTokenDecodeResult) {
    req.User = accessTokenDecodeResult.valid;
    return next();
  } else {
    const { exp } = accessTokenDecodeResult.expired;
    const now = Math.floor(Date.now() / 1000);

    if (exp + 3 * 24 * 60 * 60 < now) {
      return next(new AppError("Invalid token. Please log in again.", 401));
    }

    const refreshTokenDecodeResult = decodeData(
      refreshToken,
      RefreshTokenPayloadSchema,
    );

    if (!refreshTokenDecodeResult || "expired" in refreshTokenDecodeResult) {
      return next(new AppError("Invalid token. Please log in again.", 401));
    }

    const { username, exp: refreshExp } = refreshTokenDecodeResult.valid;

    try {
      const authenticatedUser = await authService.loginWithUsername(username);

      // Regenerate access_token
      const newAccessToken = encodeData(authenticatedUser, {
        expiresIn: "30m",
      });
      res.cookie("access_token", newAccessToken, {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        maxAge: 30 * 60 * 1000,
        path: "/",
      });

      // Check if refresh_token is within 1 day of expiry
      if (refreshExp - now <= 24 * 60 * 60) {
        // Refresh the refresh_token (extend to 3 days)
        const newRefreshToken = encodeData({ username }, { expiresIn: "3d" });
        res.cookie("refresh_token", newRefreshToken, {
          httpOnly: true,
          secure: true,
          sameSite: "none",
          maxAge: 3 * 24 * 60 * 60 * 1000,
          path: "/",
        });
      }
      req.User = authenticatedUser;
      return next();
    } catch {
      return next(new AppError("Invalid token. Please log in again.", 401));
    }
  }
}

export const authenticateLax = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (req.User) {
      return next();
    }

    const accessToken = req.cookies.access_token;
    const refreshToken = req.cookies.refresh_token;

    if (!accessToken) {
      return next(); // Lax mode: no token → continue without user
    }

    const accessTokenDecodeResult = decodeData(
      accessToken,
      AuthenticatedUserSchema,
    );

    if (!accessTokenDecodeResult) {
      return next(); // invalid token → continue without user
    }

    if ("valid" in accessTokenDecodeResult) {
      req.User = accessTokenDecodeResult.valid;
      return next();
    }

    // access token is expired shape
    const { exp } = accessTokenDecodeResult.expired;
    const now = Math.floor(Date.now() / 1000);

    // If expired by more than 3 days, treat as invalid and continue without user
    const threeDaysInSeconds = 3 * 24 * 60 * 60;
    if (exp + threeDaysInSeconds < now) {
      return next();
    }

    // Otherwise, try to refresh using refresh_token
    if (!refreshToken) {
      return next();
    }

    const refreshTokenDecodeResult = decodeData(
      refreshToken,
      RefreshTokenPayloadSchema,
    );

    if (!refreshTokenDecodeResult || "expired" in refreshTokenDecodeResult) {
      return next();
    }

    const { username, exp: refreshExp } = refreshTokenDecodeResult.valid;

    try {
      const authenticatedUser = await authService.loginWithUsername(username);

      // Regenerate access_token
      const newAccessToken = encodeData(authenticatedUser, {
        expiresIn: "30m",
      });
      res.cookie("access_token", newAccessToken, {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        maxAge: 30 * 60 * 1000, // 30 minutes
        path: "/",
      });

      // If refresh_token is within 1 day of expiry, refresh it to 3 days
      const oneDayInSeconds = 24 * 60 * 60;
      if (refreshExp - now <= oneDayInSeconds) {
        const newRefreshToken = encodeData({ username }, { expiresIn: "3d" });
        res.cookie("refresh_token", newRefreshToken, {
          httpOnly: true,
          secure: true,
          sameSite: "none",
          maxAge: 3 * 24 * 60 * 60 * 1000, // 3 days
          path: "/",
        });
      }

      req.User = authenticatedUser;
      return next();
    } catch {
      return next();
    }
  } catch {
    return next();
  }
};

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
