import Redis from "ioredis";
import variables from "./env";

const redis = new Redis(
  variables.services.azure.redisUrl || "redis://localhost:6379"
);

redis.on("error", (err) => {
  console.error("Redis connection error:", err);
});

export default redis;
