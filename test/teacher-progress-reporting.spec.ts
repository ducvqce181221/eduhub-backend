import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { ProgressService } from "../src/progress/progress.service";
import { createPrismaClient } from "../src/lib/prisma";
import type { PrismaClient } from "../src/generated/prisma/client";
import {
  CourseStatus,
  EnrollmentStatus,
  Role,
} from "../src/generated/prisma/client";

describe("Phase 6 - Part 4: Teacher & Admin Progress Reporting Aggregation (TDD Test Suite)", () => {
  let prisma: PrismaClient;
  let progressService: ProgressService;

  let activeCategoryId: string;
  let teacherOwnerId: string;
  let teacherOtherId: string;
  let studentAId: string;
  let studentBId: string;
  let studentCId: string;
  let adminId: string;

  let courseId: string;
  let lesson1Id: string;
  let lesson2Id: string;
  let lesson3Id: string;
  let lesson4Id: string;

  const timestamp = Date.now();

  beforeAll(async () => {
    prisma = createPrismaClient();
    await prisma.$connect();

    progressService = new ProgressService(prisma as any);

    // 1. Create Category
    const category = await prisma.category.create({
      data: {
        name: `TeacherReportCat_${timestamp}`,
        slug: `teacher-report-cat-${timestamp}`,
        isActive: true,
      },
    });
    activeCategoryId = category.id;

    // 2. Create Users
    const teacherOwner = await prisma.user.create({
      data: {
        email: `teacher_owner_rep_${timestamp}@eduhub.test`,
        passwordHash: "hashed_pwd",
        fullName: "Owner Teacher",
        role: Role.TEACHER,
      },
    });
    teacherOwnerId = teacherOwner.id;

    const teacherOther = await prisma.user.create({
      data: {
        email: `teacher_other_rep_${timestamp}@eduhub.test`,
        passwordHash: "hashed_pwd",
        fullName: "Other Teacher",
        role: Role.TEACHER,
      },
    });
    teacherOtherId = teacherOther.id;

    const studentA = await prisma.user.create({
      data: {
        email: `student_a_rep_${timestamp}@eduhub.test`,
        passwordHash: "hashed_pwd",
        fullName: "Student Alpha",
        role: Role.STUDENT,
      },
    });
    studentAId = studentA.id;

    const studentB = await prisma.user.create({
      data: {
        email: `student_b_rep_${timestamp}@eduhub.test`,
        passwordHash: "hashed_pwd",
        fullName: "Student Beta",
        role: Role.STUDENT,
      },
    });
    studentBId = studentB.id;

    const studentC = await prisma.user.create({
      data: {
        email: `student_c_rep_${timestamp}@eduhub.test`,
        passwordHash: "hashed_pwd",
        fullName: "Student Gamma",
        role: Role.STUDENT,
      },
    });
    studentCId = studentC.id;

    const admin = await prisma.user.create({
      data: {
        email: `admin_rep_${timestamp}@eduhub.test`,
        passwordHash: "hashed_pwd",
        fullName: "Admin Reporting",
        role: Role.ADMIN,
      },
    });
    adminId = admin.id;

    // 3. Create Course with 4 lessons
    const course = await prisma.course.create({
      data: {
        title: "Teacher Reporting Test Course",
        slug: `teacher-rep-course-${timestamp}`,
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
                        durationSeconds: 200,
                      },
                    },
                  },
                  {
                    title: "Lesson 2",
                    order: 2,
                    video: {
                      create: {
                        title: "Video 2",
                        videoUrl: "https://r2.eduhub.test/v2.mp4",
                        durationSeconds: 200,
                      },
                    },
                  },
                  {
                    title: "Lesson 3",
                    order: 3,
                    video: {
                      create: {
                        title: "Video 3",
                        videoUrl: "https://r2.eduhub.test/v3.mp4",
                        durationSeconds: 200,
                      },
                    },
                  },
                  {
                    title: "Lesson 4",
                    order: 4,
                    video: {
                      create: {
                        title: "Video 4",
                        videoUrl: "https://r2.eduhub.test/v4.mp4",
                        durationSeconds: 200,
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

    courseId = course.id;
    const lessons = course.chapters[0].lessons;
    lesson1Id = lessons[0].id;
    lesson2Id = lessons[1].id;
    lesson3Id = lessons[2].id;
    lesson4Id = lessons[3].id;

    // 4. Enroll Students:
    // Student A: 4/4 lessons completed = 100% (COMPLETED)
    // Student B: 2/4 lessons completed = 50% (ACTIVE)
    // Student C: 0/4 lessons completed = 0% (ACTIVE)
    await prisma.enrollment.createMany({
      data: [
        {
          studentId: studentAId,
          courseId,
          status: EnrollmentStatus.COMPLETED,
          completedAt: new Date(),
        },
        {
          studentId: studentBId,
          courseId,
          status: EnrollmentStatus.ACTIVE,
        },
        {
          studentId: studentCId,
          courseId,
          status: EnrollmentStatus.ACTIVE,
        },
      ],
    });

    // Student A progress: all 4 lessons completed
    await prisma.lessonProgress.createMany({
      data: [
        { studentId: studentAId, lessonId: lesson1Id, watchedSeconds: 200, isCompleted: true, completedAt: new Date() },
        { studentId: studentAId, lessonId: lesson2Id, watchedSeconds: 200, isCompleted: true, completedAt: new Date() },
        { studentId: studentAId, lessonId: lesson3Id, watchedSeconds: 200, isCompleted: true, completedAt: new Date() },
        { studentId: studentAId, lessonId: lesson4Id, watchedSeconds: 200, isCompleted: true, completedAt: new Date() },
      ],
    });

    // Student B progress: 2 lessons completed
    await prisma.lessonProgress.createMany({
      data: [
        { studentId: studentBId, lessonId: lesson1Id, watchedSeconds: 200, isCompleted: true, completedAt: new Date() },
        { studentId: studentBId, lessonId: lesson2Id, watchedSeconds: 200, isCompleted: true, completedAt: new Date() },
      ],
    });
  });

  afterAll(async () => {
    // Cleanup
    await prisma.lessonProgress.deleteMany({
      where: {
        studentId: { in: [studentAId, studentBId, studentCId] },
      },
    });
    await prisma.enrollment.deleteMany({
      where: { courseId },
    });
    await prisma.course.deleteMany({
      where: { id: courseId },
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
            studentCId,
            adminId,
          ],
        },
      },
    });
    await prisma.$disconnect();
  });

  // ---------------------------------------------------------------------------
  // 1. Teacher Enrolled Students Single-Query Aggregation [BR-PRG-04, FR-E03]
  // ---------------------------------------------------------------------------
  describe("getCourseStudents() - Real-time SQL Aggregation Reporting [BR-PRG-04]", () => {
    it("should return enrolled students list with accurately aggregated dynamic progress metrics", async () => {
      const students = await progressService.getCourseStudents(
        teacherOwnerId,
        Role.TEACHER,
        courseId,
      );

      expect(Array.isArray(students)).toBe(true);
      expect(students.length).toBe(3);

      // Student A: 4/4 completed = 100%
      const studentA = students.find((s) => s.studentId === studentAId);
      expect(studentA).toBeDefined();
      expect(studentA?.fullName).toBe("Student Alpha");
      expect(studentA?.email).toBe(`student_a_rep_${timestamp}@eduhub.test`);
      expect(studentA?.completedLessons).toBe(4);
      expect(studentA?.totalLessons).toBe(4);
      expect(studentA?.progressPercentage).toBe(100);
      expect(studentA?.isCompleted).toBe(true);

      // Student B: 2/4 completed = 50%
      const studentB = students.find((s) => s.studentId === studentBId);
      expect(studentB).toBeDefined();
      expect(studentB?.fullName).toBe("Student Beta");
      expect(studentB?.completedLessons).toBe(2);
      expect(studentB?.totalLessons).toBe(4);
      expect(studentB?.progressPercentage).toBe(50);
      expect(studentB?.isCompleted).toBe(false);

      // Student C: 0/4 completed = 0%
      const studentC = students.find((s) => s.studentId === studentCId);
      expect(studentC).toBeDefined();
      expect(studentC?.fullName).toBe("Student Gamma");
      expect(studentC?.completedLessons).toBe(0);
      expect(studentC?.totalLessons).toBe(4);
      expect(studentC?.progressPercentage).toBe(0);
      expect(studentC?.isCompleted).toBe(false);
    });

    it("should allow Admin to view student progress for any course", async () => {
      const students = await progressService.getCourseStudents(
        adminId,
        Role.ADMIN,
        courseId,
      );

      expect(Array.isArray(students)).toBe(true);
      expect(students.length).toBe(3);
    });

    it("should reject non-owner Teacher with 403 Forbidden", async () => {
      await expect(
        progressService.getCourseStudents(
          teacherOtherId,
          Role.TEACHER,
          courseId,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it("should reject Student role from accessing teacher reporting with 403 Forbidden", async () => {
      await expect(
        progressService.getCourseStudents(
          studentAId,
          Role.STUDENT,
          courseId,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it("should throw 404 NotFoundException if course does not exist", async () => {
      await expect(
        progressService.getCourseStudents(
          teacherOwnerId,
          Role.TEACHER,
          "00000000-0000-0000-0000-000000000000",
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Aggregate Course Progress Summary [05_API_Design §2.4]
  // ---------------------------------------------------------------------------
  describe("getCourseSummaryProgress() - Course Aggregate Statistics", () => {
    it("should calculate aggregate statistics across all enrolled students", async () => {
      const summary = await progressService.getCourseSummaryProgress(
        teacherOwnerId,
        Role.TEACHER,
        courseId,
      );

      expect(summary.courseId).toBe(courseId);
      expect(summary.totalLessons).toBe(4);
      expect(summary.totalEnrolled).toBe(3);
      expect(summary.completedCount).toBe(1); // Student A completed
      // Average progress = (100 + 50 + 0) / 3 = 50%
      expect(summary.averageProgressPercentage).toBe(50);
    });

    it("should allow Admin to view course aggregate summary", async () => {
      const summary = await progressService.getCourseSummaryProgress(
        adminId,
        Role.ADMIN,
        courseId,
      );

      expect(summary.totalEnrolled).toBe(3);
      expect(summary.completedCount).toBe(1);
      expect(summary.averageProgressPercentage).toBe(50);
    });

    it("should reject non-owner Teacher with 403 Forbidden", async () => {
      await expect(
        progressService.getCourseSummaryProgress(
          teacherOtherId,
          Role.TEACHER,
          courseId,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
