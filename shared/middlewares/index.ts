import { AppError } from "../types";
import variables from "@/configs/env";

const allowedClients = variables.isProduction ? ["dashboard", "website"] : [];

export async function filter(
  req: { headers: { [key: string]: unknown } },
  next: (err?: Error | undefined) => void,
) {
  const client = req.headers["x-client"];

  console.log("Client:", client);

  if (
    !client ||
    typeof client !== "string" ||
    !allowedClients.includes(client)
  ) {
    return next(new AppError("Unauthorized", 403));
  }

  const origin = String(req.headers.origin);
  if (
    variables.allowedOrigins &&
    origin &&
    !variables.allowedOrigins.includes(origin)
  ) {
    return next(new AppError("CORS Error: This origin is not allowed", 403));
  }

  next();
}
