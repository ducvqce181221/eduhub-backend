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

describe("Phase 6 - Part 2: Lesson Progress, Heartbeat Clamping & Auto-Completion (TDD Test Suite)", () => {
  let prisma: PrismaClient;
  let progressService: ProgressService;

  let activeCategoryId: string;
  let teacherId: string;
  let studentAId: string;
  let studentBId: string;
  let nonEnrolledStudentId: string;

  let courseId: string;
  let lessonNoQuizId: string;
  let lessonWithQuizId: string;
  let quizId: string;

  const timestamp = Date.now();
  const videoDuration = 1000; // 1000 seconds for easy percentage calculation (90% = 900s)

  beforeAll(async () => {
    prisma = createPrismaClient();
    await prisma.$connect();

    progressService = new ProgressService(prisma as any);

    // 1. Create Category
    const category = await prisma.category.create({
      data: {
        name: `ProgressCat_${timestamp}`,
        slug: `progress-cat-${timestamp}`,
        isActive: true,
      },
    });
    activeCategoryId = category.id;

    // 2. Create Users
    const teacher = await prisma.user.create({
      data: {
        email: `teacher_prg_${timestamp}@eduhub.test`,
        passwordHash: "hashed_pwd",
        fullName: "Progress Teacher",
        role: Role.TEACHER,
      },
    });
    teacherId = teacher.id;

    const studentA = await prisma.user.create({
      data: {
        email: `student_a_prg_${timestamp}@eduhub.test`,
        passwordHash: "hashed_pwd",
        fullName: "Progress Student A",
        role: Role.STUDENT,
      },
    });
    studentAId = studentA.id;

    const studentB = await prisma.user.create({
      data: {
        email: `student_b_prg_${timestamp}@eduhub.test`,
        passwordHash: "hashed_pwd",
        fullName: "Progress Student B",
        role: Role.STUDENT,
      },
    });
    studentBId = studentB.id;

    const nonEnrolledStudent = await prisma.user.create({
      data: {
        email: `student_non_enr_${timestamp}@eduhub.test`,
        passwordHash: "hashed_pwd",
        fullName: "Non Enrolled Student",
        role: Role.STUDENT,
      },
    });
    nonEnrolledStudentId = nonEnrolledStudent.id;

    // 3. Create Course with 2 Lessons (Lesson 1: Video only; Lesson 2: Video + Quiz)
    const course = await prisma.course.create({
      data: {
        title: "Progress Tracking Course",
        slug: `progress-course-${timestamp}`,
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
                    title: "Lesson 1 - Video Only",
                    order: 1,
                    video: {
                      create: {
                        title: "Video 1",
                        videoUrl: "https://r2.eduhub.test/v1.mp4",
                        durationSeconds: videoDuration,
                      },
                    },
                  },
                  {
                    title: "Lesson 2 - Video and Quiz",
                    order: 2,
                    video: {
                      create: {
                        title: "Video 2",
                        videoUrl: "https://r2.eduhub.test/v2.mp4",
                        durationSeconds: videoDuration,
                      },
                    },
                    quiz: {
                      create: {
                        title: "Lesson 2 Quiz",
                        passScore: 80,
                        questions: {
                          create: [
                            {
                              content: "What is 2 + 2?",
                              order: 1,
                              points: 10,
                              answers: {
                                create: [
                                  { content: "4", isCorrect: true },
                                  { content: "5", isCorrect: false },
                                ],
                              },
                            },
                          ],
                        },
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
            lessons: {
              include: {
                quiz: true,
              },
            },
          },
        },
      },
    });

    courseId = course.id;
    lessonNoQuizId = course.chapters[0].lessons[0].id;
    lessonWithQuizId = course.chapters[0].lessons[1].id;
    quizId = course.chapters[0].lessons[1].quiz!.id;

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
      ],
    });
  });

  afterAll(async () => {
    // Cleanup
    await prisma.quizAttemptAnswer.deleteMany({
      where: {
        attempt: {
          studentId: { in: [studentAId, studentBId, nonEnrolledStudentId] },
        },
      },
    });
    await prisma.quizAttempt.deleteMany({
      where: {
        studentId: { in: [studentAId, studentBId, nonEnrolledStudentId] },
      },
    });
    await prisma.lessonProgress.deleteMany({
      where: {
        studentId: { in: [studentAId, studentBId, nonEnrolledStudentId] },
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
  // 1. WatchedSeconds Validation & Clamping Tests [BR-PRG-01]
  // ---------------------------------------------------------------------------
  describe("Heartbeat WatchedSeconds Clamping & Validation [BR-PRG-01]", () => {
    it("should reject negative watchedSeconds with 400 Bad Request [BR-PRG-01]", async () => {
      await expect(
        progressService.updateLessonProgress(studentAId, lessonNoQuizId, {
          watchedSeconds: -10,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("should clamp watchedSeconds if it exceeds video durationSeconds [BR-PRG-01]", async () => {
      // Sending 1500s when video is 1000s -> should clamp to 1000s
      const progress = await progressService.updateLessonProgress(
        studentAId,
        lessonNoQuizId,
        {
          watchedSeconds: 1500,
        },
      );

      expect(progress.watchedSeconds).toBe(videoDuration);
    });

    it("should reject progress update if student is not enrolled in the course [BR-ENR-01]", async () => {
      await expect(
        progressService.updateLessonProgress(
          nonEnrolledStudentId,
          lessonNoQuizId,
          {
            watchedSeconds: 300,
          },
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it("should throw 404 NotFoundException if lesson does not exist", async () => {
      const nonExistentLessonId = "00000000-0000-0000-0000-000000000000";
      await expect(
        progressService.updateLessonProgress(
          studentAId,
          nonExistentLessonId,
          {
            watchedSeconds: 300,
          },
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Automatic Lesson Completion Evaluation Tests [BR-PRG-01, BR-PRG-02]
  // ---------------------------------------------------------------------------
  describe("Auto Lesson Completion Evaluation [BR-PRG-01, BR-PRG-02]", () => {
    it("should NOT mark lesson completed when watch progress is under 90% (e.g. 89% = 890s) [BR-PRG-01, BR-PRG-02]", async () => {
      const progress = await progressService.updateLessonProgress(
        studentBId,
        lessonNoQuizId,
        {
          watchedSeconds: 890, // 89% of 1000s
        },
      );

      expect(progress.watchedSeconds).toBe(890);
      expect(progress.isCompleted).toBe(false);
      expect(progress.completedAt).toBeNull();
    });

    it("should automatically mark lesson completed when watch progress reaches exactly 90% (900s) on lesson without quiz [BR-PRG-01, BR-PRG-02]", async () => {
      const progress = await progressService.updateLessonProgress(
        studentBId,
        lessonNoQuizId,
        {
          watchedSeconds: 900, // 90% of 1000s
        },
      );

      expect(progress.watchedSeconds).toBe(900);
      expect(progress.isCompleted).toBe(true);
      expect(progress.completedAt).toBeInstanceOf(Date);
    });

    it("should preserve isCompleted=true on subsequent heartbeats even with lower or higher watchedSeconds", async () => {
      const progress = await progressService.updateLessonProgress(
        studentBId,
        lessonNoQuizId,
        {
          watchedSeconds: 950,
        },
      );

      expect(progress.watchedSeconds).toBe(950);
      expect(progress.isCompleted).toBe(true);
      expect(progress.completedAt).toBeInstanceOf(Date);
    });

    it("should NOT mark lesson completed if video reaches >= 90% but attached Quiz is not yet passed [BR-PRG-02]", async () => {
      const progress = await progressService.updateLessonProgress(
        studentAId,
        lessonWithQuizId,
        {
          watchedSeconds: 950, // 95% of video
        },
      );

      expect(progress.watchedSeconds).toBe(950);
      // Because lessonWithQuiz has an attached quiz and studentA has no passed attempts yet:
      expect(progress.isCompleted).toBe(false);
      expect(progress.completedAt).toBeNull();
    });

    it("should mark lesson completed when video is >= 90% AND attached Quiz has at least one passed attempt [BR-PRG-02]", async () => {
      // Simulate passing quiz attempt for Student A
      await prisma.quizAttempt.create({
        data: {
          studentId: studentAId,
          quizId,
          score: 100,
          isPassed: true,
          submittedAt: new Date(),
        },
      });

      // Now send progress update again
      const progress = await progressService.updateLessonProgress(
        studentAId,
        lessonWithQuizId,
        {
          watchedSeconds: 950,
        },
      );

      expect(progress.watchedSeconds).toBe(950);
      expect(progress.isCompleted).toBe(true);
      expect(progress.completedAt).toBeInstanceOf(Date);
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Get Lesson Progress Query [FR-E04, 05_API_Design §2.6]
  // ---------------------------------------------------------------------------
  describe("Get Lesson Progress Query", () => {
    it("should return existing lesson progress record for enrolled student", async () => {
      const progress = await progressService.getLessonProgress(
        studentAId,
        lessonWithQuizId,
      );

      expect(progress).toBeDefined();
      expect(progress.studentId).toBe(studentAId);
      expect(progress.lessonId).toBe(lessonWithQuizId);
      expect(progress.isCompleted).toBe(true);
      expect(progress.watchedSeconds).toBe(950);
    });

    it("should return default initial progress (0s, uncompleted) if student has not started lesson yet", async () => {
      const progress = await progressService.getLessonProgress(
        studentBId,
        lessonWithQuizId,
      );

      expect(progress).toBeDefined();
      expect(progress.studentId).toBe(studentBId);
      expect(progress.lessonId).toBe(lessonWithQuizId);
      expect(progress.watchedSeconds).toBe(0);
      expect(progress.isCompleted).toBe(false);
      expect(progress.completedAt).toBeNull();
    });
  });
});
