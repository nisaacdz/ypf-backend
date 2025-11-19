import { IncomingMessage, ServerResponse } from "http";
import { authenticate } from "./auth";
import { CookieOptions, NextFunction, Request, Response } from "express";

type EngineNext = (err?: any) => void;

/**
 * Wrapper to use the Express `authenticate` middleware with Socket.IO (Engine.IO)
 */
export const socketAuth = (
  req: IncomingMessage & { cookies?: Record<string, string>; User?: any },
  res: ServerResponse,
  next: EngineNext,
) => {
  const mockRes = res as unknown as Response;

  mockRes.cookie = (name: string, val: any, options?: CookieOptions) => {
    const opts = { ...options }; // Clone to avoid mutating original object
    const stringVal =
      typeof val === "object" ? "j:" + JSON.stringify(val) : String(val);

    if (opts.maxAge) {
      opts.expires = new Date(Date.now() + opts.maxAge);
      opts.maxAge = opts.maxAge / 1000;
    }

    let cookieStr = `${name}=${encodeURIComponent(stringVal)}`;

    if (opts.httpOnly) cookieStr += "; HttpOnly";
    if (opts.secure) cookieStr += "; Secure";
    if (opts.path) cookieStr += `; Path=${opts.path}`;
    if (opts.expires) cookieStr += `; Expires=${opts.expires.toUTCString()}`;
    if (opts.maxAge) cookieStr += `; Max-Age=${opts.maxAge}`;
    if (opts.sameSite) cookieStr += `; SameSite=${opts.sameSite}`;

    if (opts.domain) cookieStr += `; Domain=${opts.domain}`;

    const existing = res.getHeader("Set-Cookie");
    let headers: string[] = [];

    if (Array.isArray(existing)) {
      headers = existing as string[];
    } else if (typeof existing === "string") {
      headers = [existing];
    } else if (typeof existing === "number") {
      headers = [existing.toString()];
    }

    headers.push(cookieStr);
    res.setHeader("Set-Cookie", headers);
    return mockRes;
  };

  mockRes.status = (code: number) => {
    res.statusCode = code;
    return mockRes;
  };

  mockRes.json = (body: any) => {
    const err = new Error(JSON.stringify(body));
    (err as any).status = res.statusCode;
    next(err);
    return mockRes;
  };

  authenticate(req as Request, mockRes, (err?: any) => {
    if (err) {
      next(err);
    } else {
      // Success
      next();
    }
  });
};
