import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import { ValidationPipe } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { RedisCacheService } from "../src/common/cache/redis-cache.service";
import { TransformInterceptor } from "../src/common/interceptors/transform.interceptor";
import { HttpExceptionFilter } from "../src/common/filters/http-exception.filter";

describe("Security: HTTP Headers & Upload Rate Limiting [Vulnerabilities 5 & 6]", () => {
  let app: INestApplication;
  let cacheService: RedisCacheService;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();

    // Security headers middleware as configured in main.ts
    app.use((_req: any, res: any, next: any) => {
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("X-Frame-Options", "SAMEORIGIN");
      res.setHeader("X-XSS-Protection", "0");
      res.setHeader(
        "Strict-Transport-Security",
        "max-age=31536000; includeSubDomains",
      );
      res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
      res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
      res.removeHeader?.("X-Powered-By");
      next();
    });

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
    await cacheService.delByPattern("ratelimit:*");
    if (app) {
      await app.close();
    }
  });

  beforeEach(async () => {
    await cacheService.delByPattern("ratelimit:*");
  });

  describe("1. HTTP Security Headers (Vulnerability 5)", () => {
    it("should set all critical security headers on API responses", async () => {
      const res = await request(app.getHttpServer()).get("/api/v1/health");

      expect(res.headers["x-content-type-options"]).toBe("nosniff");
      expect(res.headers["x-frame-options"]).toBe("SAMEORIGIN");
      expect(res.headers["x-xss-protection"]).toBe("0");
      expect(res.headers["strict-transport-security"]).toContain("max-age=31536000");
      expect(res.headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
      expect(res.headers["cross-origin-opener-policy"]).toBe("same-origin-allow-popups");
      expect(res.headers["x-powered-by"]).toBeUndefined();
    });
  });

  describe("2. Upload Rate Limiting (Vulnerability 6)", () => {
    it("should enforce rate limiting on POST /api/v1/upload/image when limit is exceeded", async () => {
      const testIp = "192.168.100.99";

      // The limit is set to 20 requests per minute
      for (let i = 0; i < 20; i++) {
        const res = await request(app.getHttpServer())
          .post("/api/v1/upload/image")
          .set("X-Forwarded-For", testIp)
          .send();

        // Should return 401 Unauthorized (since no auth token provided) rather than 429
        expect(res.status).toBe(401);
      }

      // The 21st request from the same IP should be blocked with 429 Too Many Requests
      const blockedRes = await request(app.getHttpServer())
        .post("/api/v1/upload/image")
        .set("X-Forwarded-For", testIp)
        .send();

      expect(blockedRes.status).toBe(429);
      expect(JSON.stringify(blockedRes.body)).toMatch(/too many requests/i);
    });
  });
});
