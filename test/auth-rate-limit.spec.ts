import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { RedisCacheService } from "../src/common/cache/redis-cache.service";
import { TransformInterceptor } from "../src/common/interceptors/transform.interceptor";
import { HttpExceptionFilter } from "../src/common/filters/http-exception.filter";

describe("Phase 8 - Cụm 3: Sensitive Auth Rate Limiting Tests [BR-SEC-01]", () => {
  let app: INestApplication;
  let cacheService: RedisCacheService;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalInterceptors(new TransformInterceptor());
    app.useGlobalFilters(new HttpExceptionFilter());

    await app.init();

    cacheService = moduleRef.get<RedisCacheService>(RedisCacheService);
  });

  afterAll(async () => {
    // Clean up rate limit keys in Redis
    await cacheService.delByPattern("ratelimit:*");
    if (app) {
      await app.close();
    }
  });

  beforeEach(async () => {
    // Reset rate limit keys before each test scenario
    await cacheService.delByPattern("ratelimit:*");
  });

  describe("1. Login Endpoint Rate Limiting (/auth/login)", () => {
    it("should allow up to 5 requests within 1 minute window", async () => {
      for (let i = 0; i < 5; i++) {
        const res = await request(app.getHttpServer())
          .post("/api/v1/auth/login")
          .set("X-Forwarded-For", "192.168.1.50")
          .send({
            email: "nonexistent@eduhub.test",
            password: "Password123!",
          });

        // First 5 requests should reach auth service (returning 401 Unauthorized for invalid credentials)
        expect(res.status).toBe(401);
      }
    });

    it("should block the 6th request from the same IP with 429 Too Many Requests [BR-SEC-01]", async () => {
      const clientIp = "192.168.1.51";

      // Make 5 requests
      for (let i = 0; i < 5; i++) {
        await request(app.getHttpServer())
          .post("/api/v1/auth/login")
          .set("X-Forwarded-For", clientIp)
          .send({
            email: "test@eduhub.test",
            password: "Password123!",
          });
      }

      // 6th request must be blocked
      const res = await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .set("X-Forwarded-For", clientIp)
        .send({
          email: "test@eduhub.test",
          password: "Password123!",
        });

      expect(res.status).toBe(429);
      expect(res.body).toMatchObject({
        success: false,
        statusCode: 429,
        error: "Too Many Requests",
      });
      expect(res.body.message).toBeDefined();
    });
  });

  describe("2. Protection Across All Sensitive Auth Endpoints [BR-SEC-01]", () => {
    it("should enforce rate limiting on /auth/register", async () => {
      const clientIp = "192.168.1.52";

      for (let i = 0; i < 5; i++) {
        const res = await request(app.getHttpServer())
          .post("/api/v1/auth/register")
          .set("X-Forwarded-For", clientIp)
          .send({
            email: "invalid-email",
            password: "123",
            fullName: "Test",
          });
        expect(res.status).not.toBe(429);
      }

      // 6th attempt
      const res = await request(app.getHttpServer())
        .post("/api/v1/auth/register")
        .set("X-Forwarded-For", clientIp)
        .send({
          email: "invalid-email",
          password: "123",
          fullName: "Test",
        });

      expect(res.status).toBe(429);
    });

    it("should enforce rate limiting on /auth/forgot-password", async () => {
      const clientIp = "192.168.1.53";

      for (let i = 0; i < 5; i++) {
        const res = await request(app.getHttpServer())
          .post("/api/v1/auth/forgot-password")
          .set("X-Forwarded-For", clientIp)
          .send({ email: "user@test.com" });
        expect(res.status).not.toBe(429);
      }

      // 6th attempt
      const res = await request(app.getHttpServer())
        .post("/api/v1/auth/forgot-password")
        .set("X-Forwarded-For", clientIp)
        .send({ email: "user@test.com" });

      expect(res.status).toBe(429);
    });

    it("should enforce rate limiting on /auth/reset-password", async () => {
      const clientIp = "192.168.1.54";

      for (let i = 0; i < 5; i++) {
        const res = await request(app.getHttpServer())
          .post("/api/v1/auth/reset-password")
          .set("X-Forwarded-For", clientIp)
          .send({ token: "dummy-token", newPassword: "Password123!" });
        expect(res.status).not.toBe(429);
      }

      // 6th attempt
      const res = await request(app.getHttpServer())
        .post("/api/v1/auth/reset-password")
        .set("X-Forwarded-For", clientIp)
        .send({ token: "dummy-token", newPassword: "Password123!" });

      expect(res.status).toBe(429);
    });
  });

  describe("3. IP Isolation & Recovery", () => {
    it("should not block a different IP when one IP exceeds rate limit", async () => {
      const blockedIp = "192.168.1.60";
      const cleanIp = "192.168.1.61";

      // Exhaust rate limit for blockedIp
      for (let i = 0; i < 5; i++) {
        await request(app.getHttpServer())
          .post("/api/v1/auth/login")
          .set("X-Forwarded-For", blockedIp)
          .send({ email: "test@eduhub.test", password: "Password123!" });
      }

      const blockedRes = await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .set("X-Forwarded-For", blockedIp)
        .send({ email: "test@eduhub.test", password: "Password123!" });
      expect(blockedRes.status).toBe(429);

      // cleanIp should still be allowed
      const cleanRes = await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .set("X-Forwarded-For", cleanIp)
        .send({ email: "test@eduhub.test", password: "Password123!" });
      expect(cleanRes.status).toBe(401); // Not 429
    });

    it("should allow requests again once the rate limit key is cleared/expired", async () => {
      const clientIp = "192.168.1.70";

      // Exhaust limit
      for (let i = 0; i < 5; i++) {
        await request(app.getHttpServer())
          .post("/api/v1/auth/login")
          .set("X-Forwarded-For", clientIp)
          .send({ email: "test@eduhub.test", password: "Password123!" });
      }

      // Verify blocked
      const blockedRes = await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .set("X-Forwarded-For", clientIp)
        .send({ email: "test@eduhub.test", password: "Password123!" });
      expect(blockedRes.status).toBe(429);

      // Simulate TTL expiration by deleting the key
      await cacheService.delByPattern("ratelimit:*");

      // Should be allowed again
      const retryRes = await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .set("X-Forwarded-For", clientIp)
        .send({ email: "test@eduhub.test", password: "Password123!" });
      expect(retryRes.status).toBe(401);
    });
  });
});
