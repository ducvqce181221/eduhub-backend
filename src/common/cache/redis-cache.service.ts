import {
  Injectable,
  Logger,
  Optional,
} from "@nestjs/common";
import type { OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";

import { CACHE_CONSTANTS } from "./cache.constants";

@Injectable()
export class RedisCacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisCacheService.name);
  private client!: Redis;

  constructor(
    @Optional()
    private readonly configService?: ConfigService,
  ) {
    this.initClient();
  }

  private initClient() {
    const host = this.configService?.get<string>("REDIS_HOST", "localhost") || "localhost";
    const port = Number(this.configService?.get<number>("REDIS_PORT", 6379)) || 6379;
    const password = this.configService?.get<string>("REDIS_PASSWORD", "") || undefined;

    this.client = new Redis({
      host,
      port,
      password: password || undefined,
      lazyConnect: false,
      connectTimeout: 5000,
      maxRetriesPerRequest: 2,
    });

    this.client.on("error", (err) => {
      this.logger.warn(`Redis connection warning/error: ${err.message}`);
    });
  }

  async onModuleInit() {
    // Client initialized in constructor
  }

  async onModuleDestroy() {
    try {
      if (this.client) {
        await this.client.quit();
      }
    } catch (err) {
      this.logger.warn(`Error disconnecting Redis: ${(err as Error).message}`);
    }
  }

  getClient(): Redis {
    return this.client;
  }

  /**
   * Retrieves an item from cache and deserializes it.
   * Gracefully returns null if key is not found or if Redis fails.
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      if (!this.client) return null;
      const data = await this.client.get(key);
      if (!data) return null;
      return JSON.parse(data) as T;
    } catch (err) {
      this.logger.warn(`Redis get failed for key "${key}": ${(err as Error).message}`);
      return null;
    }
  }

  /**
   * Sets an item in cache with serialization and optional TTL (defaults to 900s / 15m).
   */
  async set(
    key: string,
    value: any,
    ttlSeconds: number = CACHE_CONSTANTS.DEFAULT_TTL_SECONDS,
  ): Promise<void> {
    try {
      if (!this.client) return;
      const serialized = JSON.stringify(value);
      if (ttlSeconds && ttlSeconds > 0) {
        await this.client.set(key, serialized, "EX", ttlSeconds);
      } else {
        await this.client.set(key, serialized);
      }
    } catch (err) {
      this.logger.warn(`Redis set failed for key "${key}": ${(err as Error).message}`);
    }
  }

  /**
   * Deletes a single key from cache.
   */
  async del(key: string): Promise<void> {
    try {
      if (!this.client) return;
      await this.client.del(key);
    } catch (err) {
      this.logger.warn(`Redis del failed for key "${key}": ${(err as Error).message}`);
    }
  }

  /**
   * Deletes keys matching a pattern using non-blocking SCAN.
   * Safe for production workloads without blocking the Redis event loop.
   */
  async delByPattern(pattern: string): Promise<void> {
    try {
      if (!this.client) return;
      let cursor = "0";
      do {
        const [nextCursor, keys] = await this.client.scan(
          cursor,
          "MATCH",
          pattern,
          "COUNT",
          100,
        );
        cursor = nextCursor;
        if (keys && keys.length > 0) {
          await this.client.del(...keys);
        }
      } while (cursor !== "0");
    } catch (err) {
      this.logger.warn(
        `Redis delByPattern failed for pattern "${pattern}": ${(err as Error).message}`,
      );
    }
  }
}
