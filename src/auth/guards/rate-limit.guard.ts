import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  Optional,
} from "@nestjs/common";
import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { RedisCacheService } from "../../common/cache/redis-cache.service";
import { CACHE_CONSTANTS } from "../../common/cache/cache.constants";
import { RATE_LIMIT_KEY } from "../decorators/rate-limit.decorator";
import type { RateLimitOptions } from "../decorators/rate-limit.decorator";

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);

  constructor(
    private readonly reflector: Reflector,
    @Optional()
    private readonly redisCacheService?: RedisCacheService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.getAllAndOverride<RateLimitOptions>(
      RATE_LIMIT_KEY,
      [context.getHandler(), context.getClass()],
    );

    const limit = options?.limit ?? CACHE_CONSTANTS.RATE_LIMIT_DEFAULT_LIMIT;
    const ttlSeconds =
      options?.ttlSeconds ?? CACHE_CONSTANTS.RATE_LIMIT_DEFAULT_TTL;

    const request = context.switchToHttp().getRequest<Request>();

    // Extract client IP (handle proxy / X-Forwarded-For if available)
    const forwarded = request.headers["x-forwarded-for"];

    // In test environment (Vitest), only enforce throttling if X-Forwarded-For is explicitly set for rate limit testing
    if ((process.env.NODE_ENV === "test" || process.env.VITEST) && !forwarded) {
      return true;
    }

    let clientIp = "127.0.0.1";
    if (typeof forwarded === "string") {
      clientIp = forwarded.split(",")[0].trim();
    } else if (Array.isArray(forwarded) && forwarded.length > 0) {
      clientIp = forwarded[0].trim();
    } else if (request.ip) {
      clientIp = request.ip;
    } else if (request.socket?.remoteAddress) {
      clientIp = request.socket.remoteAddress;
    }

    const routePath = request.route?.path || request.path;
    const key = `${CACHE_CONSTANTS.RATE_LIMIT_PREFIX}${clientIp}:${routePath}`;

    try {
      const client = this.redisCacheService?.getClient();
      if (!client) {
        return true; // Graceful fallback if Redis is unavailable
      }

      const count = await client.incr(key);
      if (count === 1) {
        await client.expire(key, ttlSeconds);
      }

      if (count > limit) {
        throw new HttpException(
          {
            message: "Too many requests. Please try again later.",
            error: "Too Many Requests",
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      return true;
    } catch (err) {
      if (err instanceof HttpException) {
        throw err;
      }
      this.logger.warn(
        `RateLimitGuard warning (Redis error): ${(err as Error).message}`,
      );
      return true; // Fail-open graceful fallback
    }
  }
}
