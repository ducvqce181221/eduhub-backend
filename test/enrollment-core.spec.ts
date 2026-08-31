import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import { EnrollmentsService } from "../src/enrollments/enrollments.service";
import { EnrollmentGuard } from "../src/auth/guards/enrollment.guard";
import { createPrismaClient } from "../src/lib/prisma";
import type { PrismaClient } from "../src/generated/prisma/client";
import {
  CourseStatus,
  EnrollmentStatus,
  Role,
} from "../src/generated/prisma/client";

describe("Phase 6 - Part 1: Enrollment Core & Eligibility (TDD Test Suite)", () => {
  let prisma: PrismaClient;
  let enrollmentsService: EnrollmentsService;
  let enrollmentGuard: EnrollmentGuard;

  let activeCategoryId: string;
  let teacherOwnerId: string;
  let teacherOtherId: string;
  let studentAId: string;
  let studentBId: string;
  let adminId: string;

  let publishedCourseId: string;
  let draftCourseId: string;
  let archivedCourseId: string;
  let lessonInPubCourseId: string;

  const timestamp = Date.now();

  // Helper to create mock ExecutionContext for testing Guards
  const createMockContext = (
    user?: { id: string; email: string; role: string },
    params: Record<string, string> = {},
    path = "/lessons/:id",
  ): ExecutionContext => {
    const handler = () => {};
    const targetClass = class {};

    const request = {
      user,
      params,
      route: { path },
      url: path,
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

    enrollmentsService = new EnrollmentsService(prisma as any);
    enrollmentGuard = new EnrollmentGuard(prisma as any);

    // 1. Create Category
    const category = await prisma.category.create({
      data: {
        name: `EnrollmentCat_${timestamp}`,
        slug: `enrollment-cat-${timestamp}`,
        isActive: true,
      },
    });
    activeCategoryId = category.id;

    // 2. Create Users
    const teacherOwner = await prisma.user.create({
      data: {
        email: `teacher_owner_${timestamp}@eduhub.test`,
        passwordHash: "hashed_pwd",
        fullName: "Teacher Owner",
        role: Role.TEACHER,
      },
    });
    teacherOwnerId = teacherOwner.id;

    const teacherOther = await prisma.user.create({
      data: {
        email: `teacher_other_${timestamp}@eduhub.test`,
        passwordHash: "hashed_pwd",
        fullName: "Teacher Other",
        role: Role.TEACHER,
      },
    });
    teacherOtherId = teacherOther.id;

    const studentA = await prisma.user.create({
      data: {
        email: `student_a_${timestamp}@eduhub.test`,
        passwordHash: "hashed_pwd",
        fullName: "Student A",
        role: Role.STUDENT,
      },
    });
    studentAId = studentA.id;

    const studentB = await prisma.user.create({
      data: {
        email: `student_b_${timestamp}@eduhub.test`,
        passwordHash: "hashed_pwd",
        fullName: "Student B",
        role: Role.STUDENT,
      },
    });
    studentBId = studentB.id;

    const admin = await prisma.user.create({
      data: {
        email: `admin_enr_${timestamp}@eduhub.test`,
        passwordHash: "hashed_pwd",
        fullName: "Admin User",
        role: Role.ADMIN,
      },
    });
    adminId = admin.id;

    // 3. Create Courses with different statuses
    // Published Course with 1 Chapter, 1 Lesson + Video
    const pubCourse = await prisma.course.create({
      data: {
        title: "Published Course for Enrollment",
        slug: `pub-course-enr-${timestamp}`,
        categoryId: activeCategoryId,
        teacherId: teacherOwnerId,
        status: CourseStatus.PUBLISHED,
        publishedAt: new Date(),
        chapters: {
          create: [
            {
              title: "Chapter 1",
              order: 1,
              lessons: {
                create: [
                  {
                    title: "Lesson 1",
                    order: 1,
                    video: {
                      create: {
                        title: "Video 1",
                        videoUrl: "https://r2.eduhub.test/v1.mp4",
                        durationSeconds: 600,
                      },
                    },
                  },
                ],
              },
            },
          ],
        },
      },
      include: {
        chapters: {
          include: {
            lessons: true,
          },
        },
      },
    });
    publishedCourseId = pubCourse.id;
    lessonInPubCourseId = pubCourse.chapters[0].lessons[0].id;

    // Draft Course
    const draftCourse = await prisma.course.create({
      data: {
        title: "Draft Course for Enrollment",
        slug: `draft-course-enr-${timestamp}`,
        categoryId: activeCategoryId,
        teacherId: teacherOwnerId,
        status: CourseStatus.DRAFT,
      },
    });
    draftCourseId = draftCourse.id;

    // Archived Course
    const archivedCourse = await prisma.course.create({
      data: {
        title: "Archived Course for Enrollment",
        slug: `archived-course-enr-${timestamp}`,
        categoryId: activeCategoryId,
        teacherId: teacherOwnerId,
        status: CourseStatus.ARCHIVED,
      },
    });
    archivedCourseId = archivedCourse.id;
  });

  afterAll(async () => {
    // Cleanup database
    await prisma.enrollment.deleteMany({
      where: {
        courseId: {
          in: [publishedCourseId, draftCourseId, archivedCourseId],
        },
      },
    });
    await prisma.course.deleteMany({
      where: {
        id: { in: [publishedCourseId, draftCourseId, archivedCourseId] },
      },
    });
    await prisma.category.deleteMany({
      where: { id: activeCategoryId },
    });
    await prisma.user.deleteMany({
      where: {
        id: {
          in: [
            teacherOwnerId,
            teacherOtherId,
            studentAId,
            studentBId,
            adminId,
          ],
        },
      },
    });
    await prisma.$disconnect();
  });

  // ---------------------------------------------------------------------------
  // 1. Enrollment Eligibility & Validation Tests [BR-ENR-01, BR-ENR-02]
  // ---------------------------------------------------------------------------
  describe("EnrollmentsService - enroll() [BR-ENR-01, BR-ENR-02]", () => {
    it("should allow an active STUDENT to enroll in a PUBLISHED course successfully [BR-ENR-01]", async () => {
      const enrollment = await enrollmentsService.enroll(
        studentAId,
        Role.STUDENT,
        publishedCourseId,
      );

      expect(enrollment).toBeDefined();
      expect(enrollment.studentId).toBe(studentAId);
      expect(enrollment.courseId).toBe(publishedCourseId);
      expect(enrollment.status).toBe(EnrollmentStatus.ACTIVE);
      expect(enrollment.enrolledAt).toBeInstanceOf(Date);
      expect(enrollment.completedAt).toBeNull();
    });

    it("should reject duplicate enrollment by the same student in the same course with 409 Conflict [BR-ENR-02]", async () => {
      await expect(
        enrollmentsService.enroll(studentAId, Role.STUDENT, publishedCourseId),
      ).rejects.toThrow(ConflictException);
    });

    it("should reject enrollment if course status is DRAFT with 400 Bad Request [BR-ENR-01]", async () => {
      await expect(
        enrollmentsService.enroll(studentBId, Role.STUDENT, draftCourseId),
      ).rejects.toThrow(BadRequestException);
    });

    it("should reject enrollment if course status is ARCHIVED with 400 Bad Request [BR-ENR-01]", async () => {
      await expect(
        enrollmentsService.enroll(studentBId, Role.STUDENT, archivedCourseId),
      ).rejects.toThrow(BadRequestException);
    });

    it("should reject enrollment if user role is TEACHER with 400 Bad Request [BR-ENR-01]", async () => {
      await expect(
        enrollmentsService.enroll(
          teacherOtherId,
          Role.TEACHER,
          publishedCourseId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("should reject enrollment if user role is ADMIN with 400 Bad Request [BR-ENR-01]", async () => {
      await expect(
        enrollmentsService.enroll(adminId, Role.ADMIN, publishedCourseId),
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw 404 NotFoundException if course does not exist", async () => {
      const nonExistentCourseId = "00000000-0000-0000-0000-000000000000";
      await expect(
        enrollmentsService.enroll(
          studentBId,
          Role.STUDENT,
          nonExistentCourseId,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Student My Enrollments Query [FR-E02]
  // ---------------------------------------------------------------------------
  describe("EnrollmentsService - getMyEnrollments()", () => {
    it("should return enrolled courses with course details for student who is enrolled", async () => {
      const enrollments = await enrollmentsService.getMyEnrollments(studentAId);

      expect(Array.isArray(enrollments)).toBe(true);
      expect(enrollments.length).toBeGreaterThanOrEqual(1);

      const found = enrollments.find((e) => e.courseId === publishedCourseId);
      expect(found).toBeDefined();
      expect(found?.course).toBeDefined();
      expect(found?.course.title).toBe("Published Course for Enrollment");
      expect(found?.course.category).toBeDefined();
      expect(found?.course.teacher).toBeDefined();
      expect(found?.status).toBe(EnrollmentStatus.ACTIVE);
    });

    it("should return empty array for student with no enrollments", async () => {
      const enrollments = await enrollmentsService.getMyEnrollments(studentBId);

      expect(Array.isArray(enrollments)).toBe(true);
      expect(enrollments.length).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // 3. EnrollmentGuard Access Control Tests
  // ---------------------------------------------------------------------------
  describe("EnrollmentGuard", () => {
    it("should allow enrolled student to access lesson content via params.id", async () => {
      const context = createMockContext(
        { id: studentAId, email: "student_a@eduhub.test", role: Role.STUDENT },
        { id: lessonInPubCourseId },
        "/lessons/:id",
      );

      const canAccess = await enrollmentGuard.canActivate(context);
      expect(canAccess).toBe(true);
    });

    it("should allow enrolled student to access via params.lessonId", async () => {
      const context = createMockContext(
        { id: studentAId, email: "student_a@eduhub.test", role: Role.STUDENT },
        { lessonId: lessonInPubCourseId },
        "/lessons/:lessonId/progress",
      );

      const canAccess = await enrollmentGuard.canActivate(context);
      expect(canAccess).toBe(true);
    });

    it("should allow enrolled student to access via params.courseId", async () => {
      const context = createMockContext(
        { id: studentAId, email: "student_a@eduhub.test", role: Role.STUDENT },
        { courseId: publishedCourseId },
        "/me/progress/courses/:courseId",
      );

      const canAccess = await enrollmentGuard.canActivate(context);
      expect(canAccess).toBe(true);
    });

    it("should deny non-enrolled student with 403 Forbidden on lesson content", async () => {
      const context = createMockContext(
        { id: studentBId, email: "student_b@eduhub.test", role: Role.STUDENT },
        { id: lessonInPubCourseId },
        "/lessons/:id",
      );

      await expect(enrollmentGuard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("should allow course owner (Teacher) to access lesson content without enrollment", async () => {
      const context = createMockContext(
        {
          id: teacherOwnerId,
          email: "teacher_owner@eduhub.test",
          role: Role.TEACHER,
        },
        { id: lessonInPubCourseId },
        "/lessons/:id",
      );

      const canAccess = await enrollmentGuard.canActivate(context);
      expect(canAccess).toBe(true);
    });

    it("should deny non-owner Teacher from accessing lesson content with 403 Forbidden", async () => {
      const context = createMockContext(
        {
          id: teacherOtherId,
          email: "teacher_other@eduhub.test",
          role: Role.TEACHER,
        },
        { id: lessonInPubCourseId },
        "/lessons/:id",
      );

      await expect(enrollmentGuard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("should allow Admin to access any lesson content without enrollment", async () => {
      const context = createMockContext(
        { id: adminId, email: "admin@eduhub.test", role: Role.ADMIN },
        { id: lessonInPubCourseId },
        "/lessons/:id",
      );

      const canAccess = await enrollmentGuard.canActivate(context);
      expect(canAccess).toBe(true);
    });

    it("should throw ForbiddenException if user is not authenticated", async () => {
      const context = createMockContext(undefined, { id: lessonInPubCourseId });

      await expect(enrollmentGuard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("should throw NotFoundException if targeted entity/course does not exist", async () => {
      const context = createMockContext(
        { id: studentAId, email: "student_a@eduhub.test", role: Role.STUDENT },
        { id: "00000000-0000-0000-0000-000000000000" },
        "/lessons/:id",
      );

      await expect(enrollmentGuard.canActivate(context)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
