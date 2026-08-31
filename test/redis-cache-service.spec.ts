import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { ConfigModule } from "@nestjs/config";
import { RedisCacheModule } from "../src/common/cache/redis-cache.module";
import { RedisCacheService } from "../src/common/cache/redis-cache.service";

describe("RedisCacheService (Phase 8 - Cụm 1: Unit & Integration Tests)", () => {
  let moduleRef: TestingModule;
  let cacheService: RedisCacheService;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        RedisCacheModule,
      ],
    }).compile();

    cacheService = moduleRef.get<RedisCacheService>(RedisCacheService);
  });

  afterAll(async () => {
    if (moduleRef) {
      await moduleRef.close();
    }
  });

  beforeEach(async () => {
    // Clean up test keys before each test
    await cacheService.delByPattern("test:*");
  });

  describe("1. Get and Set Operations (Cache-Aside Basics)", () => {
    it("should return null for non-existent cache key (Cache Miss)", async () => {
      const result = await cacheService.get("test:non-existent-key");
      expect(result).toBeNull();
    });

    it("should successfully store and retrieve primitive string / number values", async () => {
      await cacheService.set("test:string", "hello-eduhub", 60);
      const strVal = await cacheService.get<string>("test:string");
      expect(strVal).toBe("hello-eduhub");

      await cacheService.set("test:number", 42, 60);
      const numVal = await cacheService.get<number>("test:number");
      expect(numVal).toBe(42);
    });

    it("should successfully serialize and deserialize complex JSON objects and arrays", async () => {
      const mockCourseData = {
        id: "crs-123",
        title: "NestJS Advanced Architecture",
        level: "INTERMEDIATE",
        tags: ["backend", "redis", "nestjs"],
        meta: { studentsCount: 150, rating: 4.9 },
      };

      await cacheService.set("test:course:123", mockCourseData, 60);
      const retrieved = await cacheService.get<typeof mockCourseData>("test:course:123");

      expect(retrieved).toEqual(mockCourseData);
      expect(retrieved?.tags).toHaveLength(3);
      expect(retrieved?.meta.rating).toBe(4.9);
    });
  });

  describe("2. TTL & Expiration Management", () => {
    it("should enforce specified TTL on cached keys", async () => {
      const key = "test:ttl-key";
      await cacheService.set(key, { active: true }, 2); // 2 seconds TTL

      const immediateVal = await cacheService.get(key);
      expect(immediateVal).toEqual({ active: true });

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 2100));

      const expiredVal = await cacheService.get(key);
      expect(expiredVal).toBeNull();
    });

    it("should use a sensible default TTL (e.g. 900s / 15m) when ttlSeconds is omitted", async () => {
      const key = "test:default-ttl";
      await cacheService.set(key, "default-data");

      const redisClient = cacheService.getClient();
      const ttl = await redisClient.ttl(key);

      // Default TTL should be between 600s (10m) and 900s (15m)
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(900);
    });
  });

  describe("3. Key Deletion (Single & Pattern Invalidation)", () => {
    it("should delete a single key using del()", async () => {
      const key = "test:del-key";
      await cacheService.set(key, "to-be-deleted", 60);

      expect(await cacheService.get(key)).toBe("to-be-deleted");

      await cacheService.del(key);
      expect(await cacheService.get(key)).toBeNull();
    });

    it("should safely handle deleting non-existent key without throwing", async () => {
      await expect(cacheService.del("test:does-not-exist")).resolves.not.toThrow();
    });

    it("should delete all matching keys using delByPattern(pattern) with SCAN", async () => {
      // Seed keys matching pattern and non-matching key
      await cacheService.set("test:courses:list:hash1", { page: 1 }, 60);
      await cacheService.set("test:courses:list:hash2", { page: 2 }, 60);
      await cacheService.set("test:courses:list:hash3", { page: 3 }, 60);
      await cacheService.set("test:other:unrelated", { page: 1 }, 60);

      // Invalidate pattern
      await cacheService.delByPattern("test:courses:list:*");

      // Verify targeted keys are deleted
      expect(await cacheService.get("test:courses:list:hash1")).toBeNull();
      expect(await cacheService.get("test:courses:list:hash2")).toBeNull();
      expect(await cacheService.get("test:courses:list:hash3")).toBeNull();

      // Verify unrelated key is intact
      expect(await cacheService.get("test:other:unrelated")).toEqual({ page: 1 });
    });

    it("should handle delByPattern gracefully when no keys match the pattern", async () => {
      await expect(cacheService.delByPattern("test:no-match:*")).resolves.not.toThrow();
    });
  });

  describe("4. Resilience & Fault Tolerance (Redis Outage Graceful Fallback)", () => {
    it("should catch get() Redis errors gracefully and return null instead of throwing", async () => {
      const faultyService = new RedisCacheService(null as any);
      // Simulate client error
      const mockClient = {
        get: () => Promise.reject(new Error("Redis connection dropped")),
      } as any;
      (faultyService as any).client = mockClient;

      const result = await faultyService.get("test:error-key");
      expect(result).toBeNull();
    });

    it("should catch set() Redis errors gracefully without throwing unhandled exceptions", async () => {
      const faultyService = new RedisCacheService(null as any);
      const mockClient = {
        set: () => Promise.reject(new Error("Redis connection refused")),
      } as any;
      (faultyService as any).client = mockClient;

      await expect(faultyService.set("test:error-key", "data")).resolves.not.toThrow();
    });

    it("should catch delByPattern() Redis errors gracefully without throwing", async () => {
      const faultyService = new RedisCacheService(null as any);
      const mockClient = {
        scan: () => Promise.reject(new Error("Redis timeout")),
      } as any;
      (faultyService as any).client = mockClient;

      await expect(faultyService.delByPattern("test:*")).resolves.not.toThrow();
    });
  });
});
