import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { AppError } from "../types";
import { decodeData, encodeData } from "../utils/jwt";
import { AuthenticatedUserSchema, RefreshTokenPayloadSchema } from "../validators";
import type { GuardFunction } from "@/configs/authorizer";
import * as authService from "../services/authService";

export function authenticate(req: Request, res: Response, next: NextFunction) {
  if (req.User) {
    return next();
  }

  const token = req.cookies.access_token;
  const refreshToken = req.cookies.refresh_token;

  if (!token) {
    return next(
      new AppError("You are not logged in. Please log in to get access.", 401),
    );
  }

  const decodedUser = decodeData(token, AuthenticatedUserSchema);

  if (decodedUser) {
    req.User = decodedUser;
    return next();
  }

  // Token is invalid or expired - check if we can refresh
  // First, try to decode the token without verification to get exp
  try {
    const decoded = jwt.decode(token) as { exp?: number } | null;
    
    if (decoded && decoded.exp) {
      const now = Math.floor(Date.now() / 1000);
      const expirationTime = decoded.exp;
      const threeDaysInSeconds = 3 * 24 * 60 * 60;
      
      // Check if token expired but by no more than 3 days
      if (expirationTime < now && (now - expirationTime) <= threeDaysInSeconds) {
        // Try to refresh using refresh_token
        if (!refreshToken) {
          return next(new AppError("Invalid token. Please log in again.", 401));
        }

        const decodedRefreshToken = decodeData(refreshToken, RefreshTokenPayloadSchema);
        
        if (!decodedRefreshToken) {
          return next(new AppError("Invalid token. Please log in again.", 401));
        }

        // Re-authenticate using the username from refresh token
        authService.loginWithUsername(decodedRefreshToken.username)
          .then((authenticatedUser) => {
            // Regenerate access_token
            const newAccessToken = encodeData(authenticatedUser, { expiresIn: "30m" });
            res.cookie("access_token", newAccessToken, {
              httpOnly: true,
              secure: true,
              sameSite: "none",
              maxAge: 30 * 60 * 1000, // 30 minutes
              path: "/",
            });

            // Check if refresh_token is within 1 day of expiry
            const refreshExp = decodedRefreshToken.exp;
            const oneDayInSeconds = 24 * 60 * 60;
            if (refreshExp - now <= oneDayInSeconds) {
              // Refresh the refresh_token (extend to 3 days)
              const newRefreshToken = encodeData(
                { username: decodedRefreshToken.username },
                { expiresIn: "3d" }
              );
              res.cookie("refresh_token", newRefreshToken, {
                httpOnly: true,
                secure: true,
                sameSite: "none",
                maxAge: 3 * 24 * 60 * 60 * 1000, // 3 days
                path: "/",
              });
            }

            req.User = authenticatedUser;
            next();
          })
          .catch(() => {
            next(new AppError("Invalid token. Please log in again.", 401));
          });
        return;
      }
    }
  } catch {
    // If we can't decode, fall through to error
  }

  return next(new AppError("Invalid token. Please log in again.", 401));
}

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

export const authenticateLax = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const token = req.cookies.access_token;
  const refreshToken = req.cookies.refresh_token;

  if (!token) {
    return next();
  }

  const decodedUser = decodeData(token, AuthenticatedUserSchema);

  if (decodedUser) {
    req.User = decodedUser;
    return next();
  }

  // Token is invalid or expired - try to refresh
  try {
    const decoded = jwt.decode(token) as { exp?: number } | null;
    
    if (decoded && decoded.exp) {
      const now = Math.floor(Date.now() / 1000);
      const expirationTime = decoded.exp;
      const threeDaysInSeconds = 3 * 24 * 60 * 60;
      
      // Check if token expired but by no more than 3 days
      if (expirationTime < now && (now - expirationTime) <= threeDaysInSeconds) {
        // Try to refresh using refresh_token
        if (!refreshToken) {
          return next(); // Lax mode - just continue without user
        }

        const decodedRefreshToken = decodeData(refreshToken, RefreshTokenPayloadSchema);
        
        if (!decodedRefreshToken) {
          return next(); // Lax mode - just continue without user
        }

        // Re-authenticate using the username from refresh token
        authService.loginWithUsername(decodedRefreshToken.username)
          .then((authenticatedUser) => {
            // Regenerate access_token
            const newAccessToken = encodeData(authenticatedUser, { expiresIn: "30m" });
            res.cookie("access_token", newAccessToken, {
              httpOnly: true,
              secure: true,
              sameSite: "none",
              maxAge: 30 * 60 * 1000, // 30 minutes
              path: "/",
            });

            // Check if refresh_token is within 1 day of expiry
            const refreshExp = decodedRefreshToken.exp;
            const oneDayInSeconds = 24 * 60 * 60;
            if (refreshExp - now <= oneDayInSeconds) {
              // Refresh the refresh_token (extend to 3 days)
              const newRefreshToken = encodeData(
                { username: decodedRefreshToken.username },
                { expiresIn: "3d" }
              );
              res.cookie("refresh_token", newRefreshToken, {
                httpOnly: true,
                secure: true,
                sameSite: "none",
                maxAge: 3 * 24 * 60 * 60 * 1000, // 3 days
                path: "/",
              });
            }

            req.User = authenticatedUser;
            next();
          })
          .catch(() => {
            // Lax mode - just continue without user if refresh fails
            next();
          });
        return;
      }
    }
  } catch {
    // If we can't decode, just continue without user (lax mode)
  }

  next();
};
