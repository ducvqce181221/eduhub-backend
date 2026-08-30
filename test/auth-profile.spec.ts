import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { TransformInterceptor } from "../src/common/interceptors/transform.interceptor";
import { HttpExceptionFilter } from "../src/common/filters/http-exception.filter";
import { createPrismaClient } from "../src/lib/prisma";
import type { PrismaClient } from "../src/generated/prisma/client";

describe("Phase 3 - Part 3: Password Reset, Change Password & Profile", () => {
  let app: INestApplication;
  let prisma: PrismaClient;

  let accessToken: string;
  const testUser = {
    email: `user.authprofile.${Date.now()}@eduhub.dev`,
    password: "Password123!",
    fullName: "Original Name",
  };

  beforeAll(async () => {
    prisma = createPrismaClient();
    await prisma.$connect();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
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

    // Register and login test user
    await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send(testUser);

    const loginRes = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({
        email: testUser.email,
        password: testUser.password,
      });

    accessToken = loginRes.body.data.accessToken;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: {
        email: {
          contains: "authprofile.",
        },
      },
    });
    await prisma.$disconnect();
    await app.close();
  });

  // -------------------------------------------------------------
  // 1. GET /api/v1/auth/me & PATCH /api/v1/auth/me Test Cases
  // -------------------------------------------------------------
  describe("Profile Management (/auth/me)", () => {
    it("GET /api/v1/auth/me should return current user profile without passwordHash", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/auth/me")
        .set("Authorization", `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({
        email: testUser.email.toLowerCase(),
        fullName: testUser.fullName,
        role: "STUDENT",
        isActive: true,
      });
      expect(res.body.data.passwordHash).toBeUndefined();
    });

    it("PATCH /api/v1/auth/me should update profile details (fullName, avatarUrl)", async () => {
      const updatedData = {
        fullName: "Updated Full Name",
        avatarUrl: "https://example.com/new-avatar.png",
      };

      const res = await request(app.getHttpServer())
        .patch("/api/v1/auth/me")
        .set("Authorization", `Bearer ${accessToken}`)
        .send(updatedData);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({
        fullName: updatedData.fullName,
        avatarUrl: updatedData.avatarUrl,
      });
      expect(res.body.data.passwordHash).toBeUndefined();
    });

    it("GET /api/v1/auth/me should reject unauthenticated request with 401 Unauthorized", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/auth/me");

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  // -------------------------------------------------------------
  // 2. POST /api/v1/auth/change-password Test Cases
  // -------------------------------------------------------------
  describe("POST /api/v1/auth/change-password", () => {
    it("should reject change password when current password is wrong", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/auth/change-password")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          currentPassword: "WrongCurrentPassword123!",
          newPassword: "NewPassword123!",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should reject change password when new password is weak [BR-USR-05]", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/auth/change-password")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          currentPassword: testUser.password,
          newPassword: "weak",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should successfully change password when current password is correct", async () => {
      const newPassword = "NewPassword123!";

      const res = await request(app.getHttpServer())
        .post("/api/v1/auth/change-password")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          currentPassword: testUser.password,
          newPassword,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify login with new password works
      const loginRes = await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .send({
          email: testUser.email,
          password: newPassword,
        });

      expect(loginRes.status).toBe(200);
      accessToken = loginRes.body.data.accessToken; // Update token for subsequent tests
    });
  });

  // -------------------------------------------------------------
  // 3. Password Reset Flow (forgot-password & reset-password)
  // -------------------------------------------------------------
  describe("Password Reset Flow (/auth/forgot-password & /auth/reset-password)", () => {
    let resetToken: string;

    it("POST /api/v1/auth/forgot-password should generate reset token for existing user", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/auth/forgot-password")
        .send({
          email: testUser.email,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.resetToken).toBeDefined();

      resetToken = res.body.data.resetToken;
    });

    it("POST /api/v1/auth/forgot-password should return success message without leaking existence for non-existent email", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/auth/forgot-password")
        .send({
          email: "unknown.user@eduhub.dev",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("POST /api/v1/auth/reset-password should reject with 401 Unauthorized when reset token is invalid", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/auth/reset-password")
        .send({
          token: "invalid.reset.token",
          newPassword: "BrandNewPassword123!",
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it("POST /api/v1/auth/reset-password should successfully reset password with valid token", async () => {
      const brandNewPassword = "BrandNewPassword123!";

      const res = await request(app.getHttpServer())
        .post("/api/v1/auth/reset-password")
        .send({
          token: resetToken,
          newPassword: brandNewPassword,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify login with brand new password
      const loginRes = await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .send({
          email: testUser.email,
          password: brandNewPassword,
        });

      expect(loginRes.status).toBe(200);
    });
  });
});
