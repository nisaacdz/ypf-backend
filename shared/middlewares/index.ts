import { AppError } from "../types";
import variables from "@/configs/env";

const allowedClients = variables.app.isProduction
  ? ["dashboard", "website"]
  : [];

export async function filter(
  req: { headers: { [key: string]: unknown } },
  next: (err?: Error | undefined) => void,
) {
  if (allowedClients.length === 0) {
    return next();
  }
  const client = req.headers["x-client"];

  if (
    !client ||
    typeof client !== "string" ||
    !allowedClients.includes(client)
  ) {
    return next(new AppError("Unauthorized", 403));
  }

  const origin = String(req.headers.origin);
  if (
    variables.security.allowedOrigins &&
    origin &&
    !variables.security.allowedOrigins.includes(origin)
  ) {
    return next(new AppError("CORS Error: This origin is not allowed", 403));
  }

  next();
}

export { rateLimit } from "./rateLimit";
