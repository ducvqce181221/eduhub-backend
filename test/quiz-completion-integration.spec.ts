import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { QuizzesService } from "../src/quizzes/quizzes.service";
import { ProgressService } from "../src/progress/progress.service";
import { createPrismaClient } from "../src/lib/prisma";
import type { PrismaClient } from "../src/generated/prisma/client";
import {
  CourseStatus,
  EnrollmentStatus,
  Role,
} from "../src/generated/prisma/client";

describe("Phase 7 - Part 4: Quiz Completion Integration & Teacher Quiz Reporting (TDD Test Suite)", () => {
  let prisma: PrismaClient;
  let quizzesService: QuizzesService;
  let progressService: ProgressService;

  let activeCategoryId: string;
  let teacherOwnerId: string;
  let teacherOtherId: string;
  let studentAId: string;
  let studentBId: string;
  let adminId: string;

  let courseId: string;
  let lesson1Id: string;
  let lesson1QuizId: string;
  let q1Ans1CorrectId: string;
  let q1Ans2WrongId: string;

  let lesson2Id: string;
  let lesson2QuizId: string;
  let q2Ans1CorrectId: string;
  let q2Ans2WrongId: string;

  const timestamp = Date.now();

  beforeAll(async () => {
    prisma = createPrismaClient();
    await prisma.$connect();

    quizzesService = new QuizzesService(prisma as any);
    progressService = new ProgressService(prisma as any);

    // 1. Create Category
    const category = await prisma.category.create({
      data: {
        name: `QuizIntCat_${timestamp}`,
        slug: `quiz-int-cat-${timestamp}`,
        isActive: true,
      },
    });
    activeCategoryId = category.id;

    // 2. Create Users
    const teacherOwner = await prisma.user.create({
      data: {
        email: `teacher_int_own_${timestamp}@eduhub.test`,
        passwordHash: "hashed_pwd",
        fullName: "Integration Teacher Owner",
        role: Role.TEACHER,
      },
    });
    teacherOwnerId = teacherOwner.id;

    const teacherOther = await prisma.user.create({
      data: {
        email: `teacher_int_oth_${timestamp}@eduhub.test`,
        passwordHash: "hashed_pwd",
        fullName: "Integration Teacher Other",
        role: Role.TEACHER,
      },
    });
    teacherOtherId = teacherOther.id;

    const studentA = await prisma.user.create({
      data: {
        email: `student_int_a_${timestamp}@eduhub.test`,
        passwordHash: "hashed_pwd",
        fullName: "Integration Student A",
        role: Role.STUDENT,
      },
    });
    studentAId = studentA.id;

    const studentB = await prisma.user.create({
      data: {
        email: `student_int_b_${timestamp}@eduhub.test`,
        passwordHash: "hashed_pwd",
        fullName: "Integration Student B",
        role: Role.STUDENT,
      },
    });
    studentBId = studentB.id;

    const admin = await prisma.user.create({
      data: {
        email: `admin_int_${timestamp}@eduhub.test`,
        passwordHash: "hashed_pwd",
        fullName: "Integration Admin",
        role: Role.ADMIN,
      },
    });
    adminId = admin.id;

    // 3. Create Course with 2 Lessons (Each has a 100s Video and a Quiz with PassScore 80)
    const course = await prisma.course.create({
      data: {
        title: "Integration Dual Requirement Course",
        slug: `quiz-int-course-${timestamp}`,
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
                    title: "Lesson 1 Dual Requirement",
                    order: 1,
                    video: {
                      create: {
                        title: "Video 1 (100s)",
                        videoUrl: "https://r2.eduhub.test/int1.mp4",
                        durationSeconds: 100,
                      },
                    },
                    quiz: {
                      create: {
                        title: "Quiz 1",
                        passScore: 80,
                        questions: {
                          create: [
                            {
                              content: "Lesson 1 Question",
                              order: 1,
                              points: 10,
                              answers: {
                                create: [
                                  { content: "Q1 Correct", isCorrect: true },
                                  { content: "Q1 Wrong", isCorrect: false },
                                ],
                              },
                            },
                          ],
                        },
                      },
                    },
                  },
                  {
                    title: "Lesson 2 Dual Requirement",
                    order: 2,
                    video: {
                      create: {
                        title: "Video 2 (100s)",
                        videoUrl: "https://r2.eduhub.test/int2.mp4",
                        durationSeconds: 100,
                      },
                    },
                    quiz: {
                      create: {
                        title: "Quiz 2",
                        passScore: 80,
                        questions: {
                          create: [
                            {
                              content: "Lesson 2 Question",
                              order: 1,
                              points: 10,
                              answers: {
                                create: [
                                  { content: "Q2 Correct", isCorrect: true },
                                  { content: "Q2 Wrong", isCorrect: false },
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
                quiz: {
                  include: {
                    questions: {
                      include: {
                        answers: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    courseId = course.id;
    const sortedLessons = [...course.chapters[0].lessons].sort(
      (a, b) => a.order - b.order,
    );

    const l1 = sortedLessons[0];
    lesson1Id = l1.id;
    lesson1QuizId = l1.quiz!.id;
    const q1 = l1.quiz!.questions[0];
    q1Ans1CorrectId = q1.answers.find((a) => a.isCorrect)!.id;
    q1Ans2WrongId = q1.answers.find((a) => !a.isCorrect)!.id;

    const l2 = sortedLessons[1];
    lesson2Id = l2.id;
    lesson2QuizId = l2.quiz!.id;
    const q2 = l2.quiz!.questions[0];
    q2Ans1CorrectId = q2.answers.find((a) => a.isCorrect)!.id;
    q2Ans2WrongId = q2.answers.find((a) => !a.isCorrect)!.id;

    // 4. Enroll Students
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
    // Scoped cleanup
    await prisma.quizAttemptAnswer.deleteMany({
      where: {
        attempt: {
          studentId: { in: [studentAId, studentBId] },
        },
      },
    });
    await prisma.quizAttempt.deleteMany({
      where: {
        studentId: { in: [studentAId, studentBId] },
      },
    });
    await prisma.lessonProgress.deleteMany({
      where: {
        studentId: { in: [studentAId, studentBId] },
      },
    });
    await prisma.answer.deleteMany({
      where: {
        question: {
          quizId: { in: [lesson1QuizId, lesson2QuizId] },
        },
      },
    });
    await prisma.question.deleteMany({
      where: {
        quizId: { in: [lesson1QuizId, lesson2QuizId] },
      },
    });
    await prisma.quiz.deleteMany({
      where: {
        id: { in: [lesson1QuizId, lesson2QuizId] },
      },
    });
    await prisma.video.deleteMany({
      where: {
        lessonId: { in: [lesson1Id, lesson2Id] },
      },
    });
    await prisma.lesson.deleteMany({
      where: {
        id: { in: [lesson1Id, lesson2Id] },
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
            adminId,
          ],
        },
      },
    });
    await prisma.$disconnect();
  });

  // ---------------------------------------------------------------------------
  // 1. Dual Requirement Lesson Completion [BR-PRG-02]
  // ---------------------------------------------------------------------------
  describe("Dual Requirement Lesson Completion [BR-PRG-02]", () => {
    it("should keep lesson isCompleted=false when video >= 90% watched but quiz is failed [BR-PRG-02]", async () => {
      // 1. Student A watches 95s of 100s video (95% >= 90%)
      await progressService.updateLessonProgress(studentAId, lesson1Id, {
        watchedSeconds: 95,
      });

      // 2. Student A submits quiz with wrong answer (0% < 80%)
      const quizRes = await quizzesService.submitQuizAttempt(
        studentAId,
        lesson1QuizId,
        {
          answers: [
            {
              questionId: (await prisma.question.findFirst({ where: { quizId: lesson1QuizId } }))!.id,
              selectedAnswerId: q1Ans2WrongId,
            },
          ],
        },
      );

      expect(quizRes.isPassed).toBe(false);
      expect(quizRes.isLessonCompleted).toBe(false);

      // Verify lesson progress in DB
      const progress = await prisma.lessonProgress.findUnique({
        where: {
          studentId_lessonId: {
            studentId: studentAId,
            lessonId: lesson1Id,
          },
        },
      });
      expect(progress?.isCompleted).toBe(false);
    });

    it("should transition lesson to isCompleted=true when passing quiz is submitted after video was watched >= 90% [BR-PRG-02]", async () => {
      // Student A retries quiz and passes (100% >= 80%)
      const q1 = await prisma.question.findFirst({ where: { quizId: lesson1QuizId } });
      const quizRes = await quizzesService.submitQuizAttempt(
        studentAId,
        lesson1QuizId,
        {
          answers: [{ questionId: q1!.id, selectedAnswerId: q1Ans1CorrectId }],
        },
      );

      expect(quizRes.isPassed).toBe(true);
      expect(quizRes.isLessonCompleted).toBe(true);

      const progress = await prisma.lessonProgress.findUnique({
        where: {
          studentId_lessonId: {
            studentId: studentAId,
            lessonId: lesson1Id,
          },
        },
      });
      expect(progress?.isCompleted).toBe(true);
      expect(progress?.completedAt).toBeInstanceOf(Date);
    });

    it("should keep lesson isCompleted=false when quiz is passed but video is watched < 90%, then auto-complete when video reaches 90% [BR-PRG-02]", async () => {
      // 1. Student B passes Quiz 1 first without watching video (0s watched)
      const q1 = await prisma.question.findFirst({ where: { quizId: lesson1QuizId } });
      const quizRes = await quizzesService.submitQuizAttempt(
        studentBId,
        lesson1QuizId,
        {
          answers: [{ questionId: q1!.id, selectedAnswerId: q1Ans1CorrectId }],
        },
      );

      expect(quizRes.isPassed).toBe(true);
      expect(quizRes.isLessonCompleted).toBe(false); // Video was 0s

      let progress = await prisma.lessonProgress.findUnique({
        where: {
          studentId_lessonId: {
            studentId: studentBId,
            lessonId: lesson1Id,
          },
        },
      });
      expect(progress?.isCompleted ?? false).toBe(false);

      // 2. Student B watches video to 90s (90% threshold reached)
      await progressService.updateLessonProgress(studentBId, lesson1Id, {
        watchedSeconds: 90,
      });

      progress = await prisma.lessonProgress.findUnique({
        where: {
          studentId_lessonId: {
            studentId: studentBId,
            lessonId: lesson1Id,
          },
        },
      });
      expect(progress?.isCompleted).toBe(true);
      expect(progress?.completedAt).toBeInstanceOf(Date);
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Course 100% Completion Trigger on Final Quiz Pass [BR-PRG-03]
  // ---------------------------------------------------------------------------
  describe("Course 100% Completion Trigger on Quiz Pass [BR-PRG-03]", () => {
    it("should transition Enrollment.status to COMPLETED when final lesson quiz is passed [BR-PRG-03]", async () => {
      // Student A already completed Lesson 1 (1/2 lessons = 50%)
      // For Lesson 2: Watch video to 100s
      await progressService.updateLessonProgress(studentAId, lesson2Id, {
        watchedSeconds: 100,
      });

      // Submit and pass Quiz 2 on Lesson 2 -> 2/2 lessons completed = 100%
      const q2 = await prisma.question.findFirst({ where: { quizId: lesson2QuizId } });
      const quizRes = await quizzesService.submitQuizAttempt(
        studentAId,
        lesson2QuizId,
        {
          answers: [{ questionId: q2!.id, selectedAnswerId: q2Ans1CorrectId }],
        },
      );

      expect(quizRes.isPassed).toBe(true);
      expect(quizRes.isLessonCompleted).toBe(true);

      // Verify Enrollment in DB
      const enrollment = await prisma.enrollment.findUnique({
        where: {
          studentId_courseId: {
            studentId: studentAId,
            courseId,
          },
        },
      });

      expect(enrollment?.status).toBe(EnrollmentStatus.COMPLETED);
      expect(enrollment?.completedAt).toBeInstanceOf(Date);
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Teacher Quiz Results Reporting [GET /courses/:courseId/quiz-results]
  // ---------------------------------------------------------------------------
  describe("Teacher Quiz Results Reporting [GET /courses/:courseId/quiz-results]", () => {
    it("should allow course owner teacher to view aggregated quiz results of enrolled students", async () => {
      const results = await quizzesService.getCourseQuizResults(
        teacherOwnerId,
        Role.TEACHER,
        courseId,
      );

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThanOrEqual(1);

      // Student A submitted Quiz 1 & Quiz 2
      const studentAQuiz1 = results.find(
        (r: any) => r.studentId === studentAId && r.quizId === lesson1QuizId,
      );
      expect(studentAQuiz1).toBeDefined();
      expect(studentAQuiz1.attemptsCount).toBe(2); // 1 fail + 1 pass
      expect(studentAQuiz1.highestScore).toBe(100);
      expect(studentAQuiz1.isPassed).toBe(true);
    });

    it("should allow Admin to view course quiz results", async () => {
      const results = await quizzesService.getCourseQuizResults(
        adminId,
        Role.ADMIN,
        courseId,
      );

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });

    it("should reject non-owner teacher from viewing quiz results with 403 Forbidden", async () => {
      await expect(
        quizzesService.getCourseQuizResults(
          teacherOtherId,
          Role.TEACHER,
          courseId,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it("should throw 404 NotFoundException if course does not exist", async () => {
      await expect(
        quizzesService.getCourseQuizResults(
          teacherOwnerId,
          Role.TEACHER,
          "00000000-0000-0000-0000-000000000000",
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
