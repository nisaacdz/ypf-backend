import { Request, Response, NextFunction } from "express";
import redisClient from "@/configs/redis";
import { ApiResponse } from "../types";
import logger from "@/configs/logger";
import variables from "@/configs/env";

type RedisApiResponse = ApiResponse<any> & { timestamp?: number };

/**
 * Middleware to check if response is cached in Redis.
 * Key construction: req.path + "?" + sorted query string.
 *
 * Must be used in conjunction with validateQuery preceding it in the middleware stack.
 *
 * Guaranteed to set the req.CacheKey property.
 *
 * If cached, returns the cached response.
 * If not, calls next().
 */
export async function redisCacheEarlyReturn(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const fullPath = req.originalUrl.split("?")[0];
  const queryParams = req.Query || {};

  const sortedQuery = new URLSearchParams(queryParams);
  sortedQuery.sort();

  const queryString = sortedQuery.toString();
  req.CacheKey = queryString ? `${fullPath}?${queryString}` : fullPath;
  try {
    const cachedData = (await redisClient.getCache(
      req.CacheKey,
    )) as RedisApiResponse;

    if (cachedData) {
      const { timestamp, ...response } = cachedData;
      if (!variables.app.isProduction) {
        logger.info(
          `Cache Hit: Returning data cached at ${timestamp ? new Date(timestamp).toISOString() : "[unset time]"}`,
        );
      }
      return res.json(response);
    }

    if (!variables.app.isProduction) {
      logger.info(`Cache Miss: No cached data found for ${req.CacheKey}`);
    }

    next();
  } catch (error) {
    logger.warn(error, "Error while reading from redis");
    next();
  }
}
