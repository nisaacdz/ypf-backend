import type { CookieOptions } from "express";
import variables from "@/configs/env";

const ACCESS_TOKEN_MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * Returns env-aware cookie options for the access_token cookie.
 *
 * - In production, the cookie must be `Secure` and use `SameSite=None` with
 *   `Partitioned` so it works across `.ypfafrica.org` subdomains (UMS + the
 *   public site) under modern third-party cookie partitioning rules.
 * - In development we're on `http://localhost`, where `Secure` cookies are
 *   silently dropped by browsers. We fall back to `SameSite=Lax` so the
 *   cookie is sent on top-level navigations and same-site fetches.
 */
export function getAccessCookieOptions(): CookieOptions {
  if (variables.app.isProduction) {
    return {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: ACCESS_TOKEN_MAX_AGE_MS,
      path: "/",
      partitioned: true,
      domain: ".ypfafrica.org",
    };
  }
  return {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    maxAge: ACCESS_TOKEN_MAX_AGE_MS,
    path: "/",
  };
}

/**
 * Options for clearing the access_token cookie. Must match the attributes
 * the cookie was originally set with — otherwise the browser keeps it.
 */
export function getAccessCookieClearOptions(): CookieOptions {
  const opts = getAccessCookieOptions();
  // clearCookie ignores maxAge; drop it for clarity.
  delete opts.maxAge;
  return opts;
}

export function getAccessCookieClearVariants(): CookieOptions[] {
  return [
    getAccessCookieClearOptions(),
    {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/",
    },
    {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      path: "/",
      partitioned: true,
    },
    {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      path: "/",
      partitioned: true,
      domain: ".ypfafrica.org",
    },
  ];
}
