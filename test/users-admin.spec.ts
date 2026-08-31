import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { TransformInterceptor } from "../src/common/interceptors/transform.interceptor";
import { HttpExceptionFilter } from "../src/common/filters/http-exception.filter";
import { TokenService } from "../src/auth/token.service";
import { createPrismaClient } from "../src/lib/prisma";
import type { PrismaClient } from "../src/generated/prisma/client";

describe("Phase 4 - Part 2: Admin User Management (UsersModule)", () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let tokenService: TokenService;

  let adminToken: string;
  let teacherToken: string;
  let studentToken: string;

  let adminId: string;
  let teacherId: string;
  let studentId: string;

  const timestamp = Date.now();

  beforeAll(async () => {
    prisma = createPrismaClient();
    await prisma.$connect();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    tokenService = moduleFixture.get<TokenService>(TokenService);

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

    // 1. Seed Admin
    const adminUser = await prisma.user.create({
      data: {
        email: `admin.mgmt.${timestamp}@eduhub.dev`,
        passwordHash: "hashed_pwd",
        fullName: "System Admin",
        role: "ADMIN",
        isActive: true,
      },
    });
    adminId = adminUser.id;

    // 2. Seed Teacher
    const teacherUser = await prisma.user.create({
      data: {
        email: `teacher.mgmt.${timestamp}@eduhub.dev`,
        passwordHash: "hashed_pwd",
        fullName: "Math Teacher",
        role: "TEACHER",
        isActive: true,
      },
    });
    teacherId = teacherUser.id;

    // 3. Seed Student
    const studentUser = await prisma.user.create({
      data: {
        email: `student.mgmt.${timestamp}@eduhub.dev`,
        passwordHash: "hashed_pwd",
        fullName: "Alex Student",
        role: "STUDENT",
        isActive: true,
      },
    });
    studentId = studentUser.id;

    // 4. Generate Tokens
    adminToken = tokenService.generateAccessToken({
      sub: adminId,
      email: adminUser.email,
      role: "ADMIN",
    });

    teacherToken = tokenService.generateAccessToken({
      sub: teacherId,
      email: teacherUser.email,
      role: "TEACHER",
    });

    studentToken = tokenService.generateAccessToken({
      sub: studentId,
      email: studentUser.email,
      role: "STUDENT",
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: {
        email: {
          contains: "mgmt.",
        },
      },
    });
    await prisma.$disconnect();
    await app.close();
  });

  // -------------------------------------------------------------
  // 1. RBAC Protection on User Endpoints
  // -------------------------------------------------------------
  describe("RBAC Route Protection", () => {
    it("should reject non-admin (STUDENT) with 403 Forbidden on GET /api/v1/users", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/users")
        .set("Authorization", `Bearer ${studentToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it("should reject non-admin (TEACHER) with 403 Forbidden on GET /api/v1/users", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/users")
        .set("Authorization", `Bearer ${teacherToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it("should reject unauthenticated request with 401 Unauthorized", async () => {
      const res = await request(app.getHttpServer()).get("/api/v1/users");

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  // -------------------------------------------------------------
  // 2. GET /api/v1/users (List & Filters)
  // -------------------------------------------------------------
  describe("GET /api/v1/users (Admin Listing & Filtering)", () => {
    it("should return paginated user list with meta info for ADMIN", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/users?page=1&limit=10")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.meta).toMatchObject({
        page: 1,
        limit: 10,
        total: expect.any(Number),
        totalPages: expect.any(Number),
      });

      // Verify sensitive field passwordHash is never returned
      res.body.data.forEach((user: any) => {
        expect(user.passwordHash).toBeUndefined();
      });
    });

    it("should filter users by role (e.g. role=TEACHER)", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/users?role=TEACHER")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.every((u: any) => u.role === "TEACHER")).toBe(true);
    });

    it("should search users by keyword (fullName or email)", async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/users?search=alex`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(
        res.body.data.some((u: any) => u.email.includes("student.mgmt.")),
      ).toBe(true);
    });
  });

  // -------------------------------------------------------------
  // 3. GET /api/v1/users/:id (User Detail)
  // -------------------------------------------------------------
  describe("GET /api/v1/users/:id", () => {
    it("should return user details by ID for ADMIN", async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/users/${studentId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({
        id: studentId,
        role: "STUDENT",
        isActive: true,
      });
      expect(res.body.data.passwordHash).toBeUndefined();
    });

    it("should return 404 Not Found when user ID does not exist", async () => {
      const nonExistentId = "00000000-0000-0000-0000-000000000000";

      const res = await request(app.getHttpServer())
        .get(`/api/v1/users/${nonExistentId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  // -------------------------------------------------------------
  // 4. POST /api/v1/users (Admin Creates User)
  // -------------------------------------------------------------
  describe("POST /api/v1/users (Admin Create User)", () => {
    it("should allow ADMIN to create a new user with TEACHER role", async () => {
      const newTeacherData = {
        email: `newteacher.mgmt.${timestamp}@eduhub.dev`,
        password: "Password123!",
        fullName: "Newly Created Teacher",
        role: "TEACHER",
      };

      const res = await request(app.getHttpServer())
        .post("/api/v1/users")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(newTeacherData);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({
        email: newTeacherData.email.toLowerCase(),
        fullName: newTeacherData.fullName,
        role: "TEACHER",
        isActive: true,
      });
      expect(res.body.data.passwordHash).toBeUndefined();
    });

    it("should reject with 409 Conflict when email already exists [BR-USR-04]", async () => {
      const duplicateData = {
        email: `student.mgmt.${timestamp}@eduhub.dev`,
        password: "Password123!",
        fullName: "Duplicate User",
        role: "STUDENT",
      };

      const res = await request(app.getHttpServer())
        .post("/api/v1/users")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(duplicateData);

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });
  });

  // -------------------------------------------------------------
  // 5. PATCH /api/v1/users/:id/role & PATCH /api/v1/users/:id/status
  // -------------------------------------------------------------
  describe("Role and Status Updates (/users/:id/role & /users/:id/status)", () => {
    it("should allow ADMIN to promote STUDENT to TEACHER", async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/users/${studentId}/role`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ role: "TEACHER" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.role).toBe("TEACHER");
    });

    it("should allow ADMIN to deactivate a user account", async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/users/${studentId}/status`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ isActive: false });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isActive).toBe(false);
    });

    it("should prevent ADMIN from deactivating their own account (Self-lockout prevention)", async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/users/${adminId}/status`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ isActive: false });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      const messageStr = Array.isArray(res.body.message)
        ? res.body.message.join(" ")
        : res.body.message;
      expect(messageStr.toLowerCase()).toContain("cannot deactivate your own account");
    });
  });
});
