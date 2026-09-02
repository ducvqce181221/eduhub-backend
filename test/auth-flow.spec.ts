import cookieParser from "cookie-parser";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { TransformInterceptor } from "../src/common/interceptors/transform.interceptor";
import { HttpExceptionFilter } from "../src/common/filters/http-exception.filter";
import { createPrismaClient } from "../src/lib/prisma";
import type { PrismaClient } from "../src/generated/prisma/client";

describe("Phase 3 - Part 2: Registration, Login, Refresh & Logout Flow", () => {
  let app: INestApplication;
  let prisma: PrismaClient;

  const testStudent = {
    email: `student.authflow.${Date.now()}@eduhub.dev`,
    password: "Password123!",
    fullName: "Test Learner",
  };

  beforeAll(async () => {
    prisma = createPrismaClient();
    await prisma.$connect();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
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
  });

  afterAll(async () => {
    // Cleanup created test users
    await prisma.user.deleteMany({
      where: {
        email: {
          contains: "authflow.",
        },
      },
    });
    await prisma.$disconnect();
    await app.close();
  });

  // -------------------------------------------------------------
  // 1. POST /api/v1/auth/register Test Cases
  // -------------------------------------------------------------
  describe("POST /api/v1/auth/register", () => {
    it("should successfully register a student account with normalized email and STUDENT role [BR-USR-01, BR-USR-04]", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/auth/register")
        .send({
          email: `  ${testStudent.email.toUpperCase()}  `, // Test normalization
          password: testStudent.password,
          fullName: testStudent.fullName,
          role: "ADMIN", // Attempt role escalation (should be ignored/forced to STUDENT)
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({
        email: testStudent.email.toLowerCase(),
        fullName: testStudent.fullName,
        role: "STUDENT",
      });
      expect(res.body.data.passwordHash).toBeUndefined();
      expect(res.body.data.id).toBeDefined();
    });

    it("should reject registration with 409 Conflict when email already exists [BR-USR-04]", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/auth/register")
        .send({
          email: testStudent.email,
          password: testStudent.password,
          fullName: "Duplicate User",
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.statusCode).toBe(409);
      expect(res.body.error).toBe("Conflict");
    });

    it("should reject registration with 400 Bad Request when password is weak [BR-USR-05]", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/auth/register")
        .send({
          email: `weak.${Date.now()}@eduhub.dev`,
          password: "weak", // Missing length, uppercase, numbers
          fullName: "Weak Password User",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.statusCode).toBe(400);
    });

    it("should reject registration with 400 Bad Request when email is invalid", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/auth/register")
        .send({
          email: "invalid-email-format",
          password: "Password123!",
          fullName: "Invalid Email User",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  // -------------------------------------------------------------
  // 2. POST /api/v1/auth/login Test Cases
  // -------------------------------------------------------------
  describe("POST /api/v1/auth/login", () => {
    it("should successfully authenticate with valid credentials, return accessToken and set httpOnly refreshToken cookie", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .send({
          email: testStudent.email,
          password: testStudent.password,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.user).toMatchObject({
        email: testStudent.email.toLowerCase(),
        fullName: testStudent.fullName,
        role: "STUDENT",
      });
      expect(res.body.data.user.passwordHash).toBeUndefined();

      // Verify Set-Cookie header for refreshToken
      const cookies = res.headers["set-cookie"];
      expect(cookies).toBeDefined();
      const refreshCookie = Array.isArray(cookies)
        ? cookies.find((c: string) => c.startsWith("refreshToken="))
        : cookies;
      expect(refreshCookie).toBeDefined();
      expect(refreshCookie).toContain("HttpOnly");
      expect(refreshCookie).toContain("SameSite=Lax");
    });

    it("should reject login with 401 Unauthorized when password is incorrect", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .send({
          email: testStudent.email,
          password: "WrongPassword!",
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.statusCode).toBe(401);
    });

    it("should reject login with 401 Unauthorized when account is deactivated [BR-USR-03]", async () => {
      // Deactivate student account
      await prisma.user.update({
        where: { email: testStudent.email.toLowerCase() },
        data: { isActive: false },
      });

      const res = await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .send({
          email: testStudent.email,
          password: testStudent.password,
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);

      // Re-activate for subsequent tests
      await prisma.user.update({
        where: { email: testStudent.email.toLowerCase() },
        data: { isActive: true },
      });
    });

    it("should reject login with 401 Unauthorized when user does not exist", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .send({
          email: "non.existent@eduhub.dev",
          password: "Password123!",
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  // -------------------------------------------------------------
  // 3. POST /api/v1/auth/refresh Test Cases
  // -------------------------------------------------------------
  describe("POST /api/v1/auth/refresh", () => {
    it("should issue a new access token when given a valid refresh token via httpOnly Cookie", async () => {
      // First login to obtain cookie
      const loginRes = await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .send({
          email: testStudent.email,
          password: testStudent.password,
        });

      const cookies = loginRes.headers["set-cookie"];
      expect(cookies).toBeDefined();

      const refreshRes = await request(app.getHttpServer())
        .post("/api/v1/auth/refresh")
        .set("Cookie", cookies)
        .send();

      expect(refreshRes.status).toBe(200);
      expect(refreshRes.body.success).toBe(true);
      expect(refreshRes.body.data.accessToken).toBeDefined();

      // Should also rotate cookie
      const newCookies = refreshRes.headers["set-cookie"];
      expect(newCookies).toBeDefined();
      const newRefreshCookie = Array.isArray(newCookies)
        ? newCookies.find((c: string) => c.startsWith("refreshToken="))
        : newCookies;
      expect(newRefreshCookie).toBeDefined();
      expect(newRefreshCookie).toContain("HttpOnly");
    });

    it("should also support refresh token passed in body as fallback", async () => {
      const loginRes = await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .send({
          email: testStudent.email,
          password: testStudent.password,
        });

      const { refreshToken } = loginRes.body.data;

      const refreshRes = await request(app.getHttpServer())
        .post("/api/v1/auth/refresh")
        .send({
          refreshToken,
        });

      expect(refreshRes.status).toBe(200);
      expect(refreshRes.body.success).toBe(true);
      expect(refreshRes.body.data.accessToken).toBeDefined();
    });

    it("should reject refresh with 401 Unauthorized when refresh token is invalid or tampered", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/auth/refresh")
        .send({
          refreshToken: "invalid.refresh.token",
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  // -------------------------------------------------------------
  // 4. POST /api/v1/auth/logout Test Cases
  // -------------------------------------------------------------
  describe("POST /api/v1/auth/logout", () => {
    it("should successfully logout when authenticated and clear the refreshToken cookie", async () => {
      const loginRes = await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .send({
          email: testStudent.email,
          password: testStudent.password,
        });

      const { accessToken } = loginRes.body.data;
      const cookies = loginRes.headers["set-cookie"];

      const logoutRes = await request(app.getHttpServer())
        .post("/api/v1/auth/logout")
        .set("Authorization", `Bearer ${accessToken}`)
        .set("Cookie", cookies)
        .send();

      expect(logoutRes.status).toBe(200);
      expect(logoutRes.body.success).toBe(true);
      expect(logoutRes.body.data.message).toBeDefined();

      // Verify cookie is cleared (empty value or expired)
      const logoutCookies = logoutRes.headers["set-cookie"];
      expect(logoutCookies).toBeDefined();
      const clearedCookie = Array.isArray(logoutCookies)
        ? logoutCookies.find((c: string) => c.startsWith("refreshToken="))
        : logoutCookies;
      expect(clearedCookie).toMatch(/refreshToken=(;|Expires|Max-Age=0)/i);
    });

    it("should reject logout with 401 Unauthorized when unauthenticated", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/auth/logout")
        .send();

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });
});
