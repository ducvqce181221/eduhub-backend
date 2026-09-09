import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { RolesGuard } from "../src/auth/guards/roles.guard";
import { CourseOwnershipGuard } from "../src/auth/guards/course-ownership.guard";
import { ROLES_KEY } from "../src/auth/decorators/roles.decorator";
import { createPrismaClient } from "../src/lib/prisma";
import type { PrismaClient } from "../src/generated/prisma/client";

describe("Phase 4 - Part 1: Authorization (RBAC & Course Ownership Guards)", () => {
  let prisma: PrismaClient;
  let reflector: Reflector;
  let rolesGuard: RolesGuard;
  let ownershipGuard: CourseOwnershipGuard;

  let teacherAId: string;
  let teacherBId: string;
  let studentId: string;
  let adminId: string;

  let courseAId: string;
  let courseBId: string;
  let categoryId: string;

  const timestamp = Date.now();

  // Helper to create mock ExecutionContext
  const createMockContext = (
    user?: { id: string; email: string; role: string },
    params: Record<string, string> = {},
    rolesMetadata?: string[],
  ): ExecutionContext => {
    const handler = () => {};
    const targetClass = class {};

    if (rolesMetadata) {
      reflector.getAllAndOverride = () => rolesMetadata;
    } else {
      reflector.getAllAndOverride = () => undefined;
    }

    const request = {
      user,
      params,
    };

    return {
      getHandler: () => handler,
      getClass: () => targetClass,
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => ({}),
        getNext: () => ({}),
      }),
    } as unknown as ExecutionContext;
  };

  beforeAll(async () => {
    prisma = createPrismaClient();
    await prisma.$connect();

    reflector = new Reflector();
    rolesGuard = new RolesGuard(reflector);
    ownershipGuard = new CourseOwnershipGuard(prisma as any);

    // 1. Create test users in Database
    const studentUser = await prisma.user.create({
      data: {
        email: `student.rbac.${timestamp}@eduhub.dev`,
        passwordHash: "hashed_pwd",
        fullName: "RBAC Student",
        role: "STUDENT",
        isActive: true,
      },
    });
    studentId = studentUser.id;

    const teacherAUser = await prisma.user.create({
      data: {
        email: `teacherA.rbac.${timestamp}@eduhub.dev`,
        passwordHash: "hashed_pwd",
        fullName: "RBAC Teacher A",
        role: "TEACHER",
        isActive: true,
      },
    });
    teacherAId = teacherAUser.id;

    const teacherBUser = await prisma.user.create({
      data: {
        email: `teacherB.rbac.${timestamp}@eduhub.dev`,
        passwordHash: "hashed_pwd",
        fullName: "RBAC Teacher B",
        role: "TEACHER",
        isActive: true,
      },
    });
    teacherBId = teacherBUser.id;

    const adminUser = await prisma.user.create({
      data: {
        email: `admin.rbac.${timestamp}@eduhub.dev`,
        passwordHash: "hashed_pwd",
        fullName: "RBAC Admin",
        role: "ADMIN",
        isActive: true,
      },
    });
    adminId = adminUser.id;

    // 2. Create Category & Courses for Ownership testing
    const category = await prisma.category.create({
      data: {
        name: `RBAC Category ${timestamp}`,
        slug: `rbac-cat-${timestamp}`,
      },
    });
    categoryId = category.id;

    const courseA = await prisma.course.create({
      data: {
        title: `Course Owned by Teacher A ${timestamp}`,
        slug: `course-a-${timestamp}`,
        teacherId: teacherAId,
        categoryId: categoryId,
      },
    });
    courseAId = courseA.id;

    const courseB = await prisma.course.create({
      data: {
        title: `Course Owned by Teacher B ${timestamp}`,
        slug: `course-b-${timestamp}`,
        teacherId: teacherBId,
        categoryId: categoryId,
      },
    });
    courseBId = courseB.id;
  });

  afterAll(async () => {
    await prisma.course.deleteMany({
      where: { id: { in: [courseAId, courseBId] } },
    });
    await prisma.category.deleteMany({
      where: { id: categoryId },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [studentId, teacherAId, teacherBId, adminId] } },
    });
    await prisma.$disconnect();
  });

  // -------------------------------------------------------------
  // 1. RolesGuard (RBAC) Test Cases
  // -------------------------------------------------------------
  describe("RolesGuard (RBAC)", () => {
    it("should allow unrestricted access when no @Roles is defined", () => {
      const context = createMockContext({
        id: studentId,
        email: "student@eduhub.dev",
        role: "STUDENT",
      });

      expect(rolesGuard.canActivate(context)).toBe(true);
    });

    it("should allow STUDENT to access route protected with @Roles('STUDENT')", () => {
      const context = createMockContext(
        { id: studentId, email: "student@eduhub.dev", role: "STUDENT" },
        {},
        ["STUDENT"],
      );

      expect(rolesGuard.canActivate(context)).toBe(true);
    });

    it("should deny TEACHER access with 403 Forbidden on @Roles('STUDENT') route", () => {
      const context = createMockContext(
        { id: teacherAId, email: "teacherA@eduhub.dev", role: "TEACHER" },
        {},
        ["STUDENT"],
      );

      expect(() => rolesGuard.canActivate(context)).toThrow(ForbiddenException);
    });

    it("should allow both TEACHER and ADMIN on route with @Roles('TEACHER', 'ADMIN')", () => {
      const teacherContext = createMockContext(
        { id: teacherAId, email: "teacherA@eduhub.dev", role: "TEACHER" },
        {},
        ["TEACHER", "ADMIN"],
      );
      expect(rolesGuard.canActivate(teacherContext)).toBe(true);

      const adminContext = createMockContext(
        { id: adminId, email: "admin@eduhub.dev", role: "ADMIN" },
        {},
        ["TEACHER", "ADMIN"],
      );
      expect(rolesGuard.canActivate(adminContext)).toBe(true);
    });

    it("should deny STUDENT with 403 Forbidden on route with @Roles('TEACHER', 'ADMIN')", () => {
      const studentContext = createMockContext(
        { id: studentId, email: "student@eduhub.dev", role: "STUDENT" },
        {},
        ["TEACHER", "ADMIN"],
      );

      expect(() => rolesGuard.canActivate(studentContext)).toThrow(
        ForbiddenException,
      );
    });

    it("should allow ADMIN on @Roles('ADMIN') route", () => {
      const adminContext = createMockContext(
        { id: adminId, email: "admin@eduhub.dev", role: "ADMIN" },
        {},
        ["ADMIN"],
      );

      expect(rolesGuard.canActivate(adminContext)).toBe(true);
    });

    it("should deny non-admin roles with 403 Forbidden on @Roles('ADMIN') route", () => {
      const teacherContext = createMockContext(
        { id: teacherAId, email: "teacherA@eduhub.dev", role: "TEACHER" },
        {},
        ["ADMIN"],
      );

      expect(() => rolesGuard.canActivate(teacherContext)).toThrow(
        ForbiddenException,
      );
    });

    it("should deny access with 403 Forbidden when request user is undefined", () => {
      const unauthContext = createMockContext(undefined, {}, ["STUDENT"]);

      expect(() => rolesGuard.canActivate(unauthContext)).toThrow(
        ForbiddenException,
      );
    });
  });

  // -------------------------------------------------------------
  // 2. CourseOwnershipGuard Test Cases
  // -------------------------------------------------------------
  describe("CourseOwnershipGuard (Ownership Verification)", () => {
    it("should allow Teacher A to update Course A (owned by Teacher A)", async () => {
      const context = createMockContext(
        { id: teacherAId, email: "teacherA@eduhub.dev", role: "TEACHER" },
        { courseId: courseAId },
      );

      const result = await ownershipGuard.canActivate(context);
      expect(result).toBe(true);
    });

    it("should deny Teacher A with 403 Forbidden when trying to modify Course B (owned by Teacher B)", async () => {
      const context = createMockContext(
        { id: teacherAId, email: "teacherA@eduhub.dev", role: "TEACHER" },
        { courseId: courseBId },
      );

      await expect(ownershipGuard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("should allow Admin to modify Course A or Course B (Admin bypasses ownership restriction)", async () => {
      const contextA = createMockContext(
        { id: adminId, email: "admin@eduhub.dev", role: "ADMIN" },
        { courseId: courseAId },
      );
      expect(await ownershipGuard.canActivate(contextA)).toBe(true);

      const contextB = createMockContext(
        { id: adminId, email: "admin@eduhub.dev", role: "ADMIN" },
        { courseId: courseBId },
      );
      expect(await ownershipGuard.canActivate(contextB)).toBe(true);
    });

    it("should return 404 Not Found when courseId does not exist", async () => {
      const nonExistentCourseId = "00000000-0000-0000-0000-000000000000";

      const context = createMockContext(
        { id: teacherAId, email: "teacherA@eduhub.dev", role: "TEACHER" },
        { courseId: nonExistentCourseId },
      );

      await expect(ownershipGuard.canActivate(context)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
