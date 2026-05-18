import { NextFunction, Request, Response } from "express";
import { ApiError } from "../types";
import { decodeData, encodeData } from "../utils/jwt";
import { AuthenticatedUserSchema } from "../validators";
import type { GuardFunction } from "@/configs/authorizer";
import * as authService from "../services/authService";
import { getAccessCookieOptions } from "../utils/cookies";

export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (req.User) {
    return next();
  }

  const accessToken = req.cookies.access_token;

  if (!accessToken) {
    return next(
      new ApiError("You are not logged in. Please log in to get access.", 401),
    );
  }

  const accessTokenDecodeResult = decodeData(
    accessToken,
    AuthenticatedUserSchema,
  );

  if (!accessTokenDecodeResult) {
    return next(new ApiError("Invalid token. Please log in again.", 401));
  }

  if ("valid" in accessTokenDecodeResult) {
    const { exp, iat, ...user } = accessTokenDecodeResult.valid;
    const now = Math.floor(Date.now() / 1000);
    const tokenAge = now - iat; // How long since token was issued
    const refreshThreshold = 30 * 60; // 30 minutes in seconds

    // Implement sliding window: refresh if token is older than 30 minutes
    if (tokenAge > refreshThreshold) {
      try {
        const authenticatedUser = await authService.loginWithUsername(
          user.email,
        );

        // Issue new token with 3-day expiry
        const newAccessToken = encodeData(authenticatedUser, {
          expiresIn: "3d",
        });
        res.cookie("access_token", newAccessToken, getAccessCookieOptions());

        req.User = authenticatedUser;
      } catch {
        // If refresh fails, continue with existing valid token
        req.User = user;
      }
    } else {
      req.User = user;
    }

    return next();
  } else {
    // Token is expired
    return next(new ApiError("Invalid token. Please log in again.", 401));
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
      const { exp, iat, ...user } = accessTokenDecodeResult.valid;
      const now = Math.floor(Date.now() / 1000);
      const tokenAge = now - iat; // How long since token was issued
      const refreshThreshold = 30 * 60; // 30 minutes in seconds

      // Implement sliding window: refresh if token is older than 30 minutes
      if (tokenAge > refreshThreshold) {
        try {
          const authenticatedUser = await authService.loginWithUsername(
            user.email,
          );

          // Issue new token with 3-day expiry
          const newAccessToken = encodeData(authenticatedUser, {
            expiresIn: "3d",
          });
        res.cookie("access_token", newAccessToken, {
          ...getAccessCookieOptions(),
        });

          req.User = authenticatedUser;
        } catch {
          // If refresh fails, continue with existing valid token
          req.User = user;
        }
      } else {
        req.User = user;
      }

      return next();
    } else {
      // Token is expired, continue without user in lax mode
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
