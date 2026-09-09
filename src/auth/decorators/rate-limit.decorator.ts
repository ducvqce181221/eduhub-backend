import { SetMetadata } from "@nestjs/common";
import { CACHE_CONSTANTS } from "../../common/cache/cache.constants";

export interface RateLimitOptions {
  limit: number;
  ttlSeconds: number;
}

export const RATE_LIMIT_KEY = "rate_limit_options";

export const RateLimit = (
  limit: number = CACHE_CONSTANTS.RATE_LIMIT_DEFAULT_LIMIT,
  ttlSeconds: number = CACHE_CONSTANTS.RATE_LIMIT_DEFAULT_TTL,
) => SetMetadata(RATE_LIMIT_KEY, { limit, ttlSeconds });

