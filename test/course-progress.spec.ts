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

describe("Phase 6 - Part 3: Dynamic Course Progress, 100% Completion & Curriculum Expansion (TDD Test Suite)", () => {
  let prisma: PrismaClient;
  let progressService: ProgressService;

  let activeCategoryId: string;
  let teacherId: string;
  let studentAId: string;
  let studentBId: string;
  let nonEnrolledStudentId: string;

  let courseId: string;
  let emptyCourseId: string;
  let chapter1Id: string;
  let lesson1Id: string;
  let lesson2Id: string;
  let newLesson3Id: string;

  const timestamp = Date.now();

  beforeAll(async () => {
    prisma = createPrismaClient();
    await prisma.$connect();

    progressService = new ProgressService(prisma as any);

    // 1. Create Category
    const category = await prisma.category.create({
      data: {
        name: `CourseProgressCat_${timestamp}`,
        slug: `course-progress-cat-${timestamp}`,
        isActive: true,
      },
    });
    activeCategoryId = category.id;

    // 2. Create Users
    const teacher = await prisma.user.create({
      data: {
        email: `teacher_cp_${timestamp}@eduhub.test`,
        passwordHash: "hashed_pwd",
        fullName: "Course Progress Teacher",
        role: Role.TEACHER,
      },
    });
    teacherId = teacher.id;

    const studentA = await prisma.user.create({
      data: {
        email: `student_a_cp_${timestamp}@eduhub.test`,
        passwordHash: "hashed_pwd",
        fullName: "Student A CP",
        role: Role.STUDENT,
      },
    });
    studentAId = studentA.id;

    const studentB = await prisma.user.create({
      data: {
        email: `student_b_cp_${timestamp}@eduhub.test`,
        passwordHash: "hashed_pwd",
        fullName: "Student B CP",
        role: Role.STUDENT,
      },
    });
    studentBId = studentB.id;

    const nonEnrolledStudent = await prisma.user.create({
      data: {
        email: `student_non_cp_${timestamp}@eduhub.test`,
        passwordHash: "hashed_pwd",
        fullName: "Non Enrolled Student CP",
        role: Role.STUDENT,
      },
    });
    nonEnrolledStudentId = nonEnrolledStudent.id;

    // 3. Create Course with 2 lessons
    const course = await prisma.course.create({
      data: {
        title: "Dynamic Progress Course",
        slug: `dynamic-progress-${timestamp}`,
        categoryId: activeCategoryId,
        teacherId,
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
                        durationSeconds: 100,
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
                        durationSeconds: 100,
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
    chapter1Id = course.chapters[0].id;
    const sortedLessons = [...course.chapters[0].lessons].sort(
      (a, b) => a.order - b.order,
    );
    lesson1Id = sortedLessons[0].id;
    lesson2Id = sortedLessons[1].id;

    // Create Empty Course with 0 lessons (for divide-by-zero defense test)
    const emptyCourse = await prisma.course.create({
      data: {
        title: "Empty Progress Course",
        slug: `empty-progress-${timestamp}`,
        categoryId: activeCategoryId,
        teacherId,
        status: CourseStatus.PUBLISHED,
        publishedAt: new Date(),
      },
    });
    emptyCourseId = emptyCourse.id;

    // 4. Enroll Student A and Student B
    await prisma.enrollment.createMany({
      data: [
        {
          studentId: studentAId,
          courseId,
          status: EnrollmentStatus.ACTIVE,
        },
        {
          studentId: studentBId,
          courseId,
          status: EnrollmentStatus.ACTIVE,
        },
        {
          studentId: studentAId,
          courseId: emptyCourseId,
          status: EnrollmentStatus.ACTIVE,
        },
      ],
    });
  });

  afterAll(async () => {
    // Cleanup
    await prisma.lessonProgress.deleteMany({
      where: {
        studentId: { in: [studentAId, studentBId, nonEnrolledStudentId] },
      },
    });
    await prisma.enrollment.deleteMany({
      where: {
        courseId: { in: [courseId, emptyCourseId] },
      },
    });
    await prisma.course.deleteMany({
      where: {
        id: { in: [courseId, emptyCourseId] },
      },
    });
    await prisma.category.deleteMany({
      where: { id: activeCategoryId },
    });
    await prisma.user.deleteMany({
      where: {
        id: {
          in: [
            teacherId,
            studentAId,
            studentBId,
            nonEnrolledStudentId,
          ],
        },
      },
    });
    await prisma.$disconnect();
  });

  // ---------------------------------------------------------------------------
  // 1. Dynamic Course Progress Calculation & Anti-Divide-by-Zero [BR-PRG-03]
  // ---------------------------------------------------------------------------
  describe("Dynamic Course Progress Calculation [BR-PRG-03]", () => {
    it("should return 0% progress when no lessons are completed", async () => {
      const summary = await progressService.getCourseProgress(
        studentAId,
        courseId,
      );

      expect(summary.courseId).toBe(courseId);
      expect(summary.totalLessons).toBe(2);
      expect(summary.completedLessons).toBe(0);
      expect(summary.progressPercentage).toBe(0);
      expect(summary.isCompleted).toBe(false);
      expect(summary.completedLessonIds).toEqual([]);
      expect(summary.status).toBe(EnrollmentStatus.ACTIVE);
    });

    it("should safely return 0% progress on a course with 0 lessons (Anti-Divide-By-Zero defense)", async () => {
      const summary = await progressService.getCourseProgress(
        studentAId,
        emptyCourseId,
      );

      expect(summary.courseId).toBe(emptyCourseId);
      expect(summary.totalLessons).toBe(0);
      expect(summary.completedLessons).toBe(0);
      expect(summary.progressPercentage).toBe(0);
      expect(summary.isCompleted).toBe(false);
    });

    it("should dynamically calculate partial progress (e.g. 1/2 = 50%) when 1 lesson is completed", async () => {
      // Complete lesson 1 for student A
      await progressService.updateLessonProgress(studentAId, lesson1Id, {
        watchedSeconds: 95, // 95% of 100s -> completes lesson 1
      });

      const summary = await progressService.getCourseProgress(
        studentAId,
        courseId,
      );

      expect(summary.totalLessons).toBe(2);
      expect(summary.completedLessons).toBe(1);
      expect(summary.progressPercentage).toBe(50);
      expect(summary.isCompleted).toBe(false);
      expect(summary.completedLessonIds).toContain(lesson1Id);
      expect(summary.status).toBe(EnrollmentStatus.ACTIVE);
    });

    it("should reject getCourseProgress if student is not enrolled with 403 Forbidden", async () => {
      await expect(
        progressService.getCourseProgress(nonEnrolledStudentId, courseId),
      ).rejects.toThrow(ForbiddenException);
    });

    it("should throw 404 NotFoundException if course does not exist", async () => {
      await expect(
        progressService.getCourseProgress(
          studentAId,
          "00000000-0000-0000-0000-000000000000",
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // 2. 100% Course Completion Trigger [BR-PRG-03]
  // ---------------------------------------------------------------------------
  describe("100% Course Completion Trigger [BR-PRG-03]", () => {
    it("should transition Enrollment.status to COMPLETED and set completedAt when 100% lessons are completed", async () => {
      // Complete lesson 2 for student A -> 2/2 completed = 100%
      await progressService.updateLessonProgress(studentAId, lesson2Id, {
        watchedSeconds: 100, // 100% of 100s -> completes lesson 2
      });

      const summary = await progressService.getCourseProgress(
        studentAId,
        courseId,
      );

      expect(summary.totalLessons).toBe(2);
      expect(summary.completedLessons).toBe(2);
      expect(summary.progressPercentage).toBe(100);
      expect(summary.isCompleted).toBe(true);
      expect(summary.status).toBe(EnrollmentStatus.COMPLETED);
      expect(summary.completedAt).toBeInstanceOf(Date);

      // Verify directly in DB
      const enrollmentInDb = await prisma.enrollment.findUnique({
        where: {
          studentId_courseId: {
            studentId: studentAId,
            courseId,
          },
        },
      });
      expect(enrollmentInDb?.status).toBe(EnrollmentStatus.COMPLETED);
      expect(enrollmentInDb?.completedAt).toBeInstanceOf(Date);
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Curriculum Expansion for Completed Enrollments [BR-ENR-04]
  // ---------------------------------------------------------------------------
  describe("Curriculum Expansion Policy [BR-ENR-04]", () => {
    it("should strictly preserve Enrollment.status = COMPLETED when new lessons are added to course, while dynamically recalculating progress percentage [BR-ENR-04]", async () => {
      // Teacher adds a 3rd lesson to Chapter 1
      const newLesson = await prisma.lesson.create({
        data: {
          chapterId: chapter1Id,
          title: "New Lesson 3 after completion",
          order: 3,
          video: {
            create: {
              title: "Video 3",
              videoUrl: "https://r2.eduhub.test/v3.mp4",
              durationSeconds: 100,
            },
          },
        },
      });
      newLesson3Id = newLesson.id;

      // Student A queries course progress now:
      // - Completed lessons: 2 (Lesson 1, Lesson 2)
      // - Total lessons now: 3
      // - Progress percentage: (2 / 3) * 100 = 66.67%
      // - Enrollment status: strictly remains COMPLETED per BR-ENR-04
      const summary = await progressService.getCourseProgress(
        studentAId,
        courseId,
      );

      expect(summary.totalLessons).toBe(3);
      expect(summary.completedLessons).toBe(2);
      expect(summary.progressPercentage).toBeCloseTo(66.67, 1);
      expect(summary.status).toBe(EnrollmentStatus.COMPLETED);
      expect(summary.isCompleted).toBe(true); // Course was historically completed

      // Verify in DB that Enrollment record was not mutated back to ACTIVE
      const enrollmentInDb = await prisma.enrollment.findUnique({
        where: {
          studentId_courseId: {
            studentId: studentAId,
            courseId,
          },
        },
      });
      expect(enrollmentInDb?.status).toBe(EnrollmentStatus.COMPLETED);
    });
  });
});
