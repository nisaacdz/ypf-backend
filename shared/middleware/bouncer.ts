import envConfig from "../../configs/env";
import { AppError } from "../types";

export default async function bouncer(
  req: { headers: { [key: string]: unknown } },
  next: (err?: Error | undefined) => void,
) {
  const clientKey = req.headers["x-client-key"];

  if (envConfig.apiKey !== clientKey) {
    return next(new AppError("Unauthorized", 401));
  }

  next();
}
