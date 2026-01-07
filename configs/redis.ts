import Redis from "ioredis";
import variables from "./env";
import logger from "./logger";

class RedisCient {
  _redis: Redis | undefined = undefined;

  async initialize() {
    if (this._redis) return;

    if (!variables.services.redis.url) return;

    this._redis = new Redis(variables.services.redis.url);

    this._redis.on("connect", () => {
      logger.info("Successfully connected to Redis");
    });

    this._redis.on("error", (err) => {
      logger.error(err, "Redis connection error");
    });
  }

  async getCache<T extends object>(key: string): Promise<T | null> {
    if (!this._redis) return null;

    try {
      const data = await this._redis.get(key);
      if (!data) return null;
      return JSON.parse(data) as T;
    } catch (error) {
      logger.error(error, `Error getting cache for key ${key}`);
      return null;
    }
  }

  /**
   * Sets a value in the cache.
   * @param key The cache key.
   * @param data The data to cache.
   * @param ttlSeconds Time to live in seconds (default: 300).
   */
  async setCache<T extends object>(
    key: string,
    data: T,
    ttlSeconds: number = 300,
  ): Promise<void> {
    if (!this._redis) return;

    await this._redis.set(key, JSON.stringify(data), "EX", ttlSeconds);
  }
}

const redisClient = new RedisCient();

export default redisClient;
