import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { QuizzesService } from "../src/quizzes/quizzes.service";
import { LessonsService } from "../src/lessons/lessons.service";
import { createPrismaClient } from "../src/lib/prisma";
import type { PrismaClient } from "../src/generated/prisma/client";
import {
  CourseStatus,
  EnrollmentStatus,
  Role,
} from "../src/generated/prisma/client";

describe("Phase 7 - Part 2: Quiz Security & Answer DTO Masking (TDD Test Suite)", () => {
  let prisma: PrismaClient;
  let quizzesService: QuizzesService;
  let lessonsService: LessonsService;

  let activeCategoryId: string;
  let teacherOwnerId: string;
  let teacherOtherId: string;
  let enrolledStudentId: string;
  let nonEnrolledStudentId: string;
  let adminId: string;

  let courseId: string;
  let lessonId: string;
  let quizId: string;

  const timestamp = Date.now();

  beforeAll(async () => {
    prisma = createPrismaClient();
    await prisma.$connect();

    quizzesService = new QuizzesService(prisma as any);
    lessonsService = new LessonsService(prisma as any);

    // 1. Create Category
    const category = await prisma.category.create({
      data: {
        name: `QuizSecCat_${timestamp}`,
        slug: `quiz-sec-cat-${timestamp}`,
        isActive: true,
      },
    });
    activeCategoryId = category.id;

    // 2. Create Users
    const teacherOwner = await prisma.user.create({
      data: {
        email: `teacher_sec_own_${timestamp}@eduhub.test`,
        passwordHash: "hashed_pwd",
        fullName: "Security Teacher Owner",
        role: Role.TEACHER,
      },
    });
    teacherOwnerId = teacherOwner.id;

    const teacherOther = await prisma.user.create({
      data: {
        email: `teacher_sec_oth_${timestamp}@eduhub.test`,
        passwordHash: "hashed_pwd",
        fullName: "Security Teacher Other",
        role: Role.TEACHER,
      },
    });
    teacherOtherId = teacherOther.id;

    const enrolledStudent = await prisma.user.create({
      data: {
        email: `student_sec_enr_${timestamp}@eduhub.test`,
        passwordHash: "hashed_pwd",
        fullName: "Security Enrolled Student",
        role: Role.STUDENT,
      },
    });
    enrolledStudentId = enrolledStudent.id;

    const nonEnrolledStudent = await prisma.user.create({
      data: {
        email: `student_sec_non_${timestamp}@eduhub.test`,
        passwordHash: "hashed_pwd",
        fullName: "Security Non-Enrolled Student",
        role: Role.STUDENT,
      },
    });
    nonEnrolledStudentId = nonEnrolledStudent.id;

    const admin = await prisma.user.create({
      data: {
        email: `admin_sec_${timestamp}@eduhub.test`,
        passwordHash: "hashed_pwd",
        fullName: "Security Admin",
        role: Role.ADMIN,
      },
    });
    adminId = admin.id;

    // 3. Create Published Course with Lesson + Video + Quiz (with Question & Answers)
    const course = await prisma.course.create({
      data: {
        title: "Security & Masking Test Course",
        slug: `quiz-sec-course-${timestamp}`,
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
                    title: "Security Lesson with Quiz",
                    order: 1,
                    video: {
                      create: {
                        title: "Security Video",
                        videoUrl: "https://r2.eduhub.test/sec.mp4",
                        durationSeconds: 500,
                      },
                    },
                    quiz: {
                      create: {
                        title: "Security Quiz",
                        passScore: 80,
                        questions: {
                          create: [
                            {
                              content: "Which HTTP header carries the JWT Bearer token?",
                              order: 1,
                              points: 10,
                              answers: {
                                create: [
                                  { content: "Authorization", isCorrect: true },
                                  { content: "Authentication", isCorrect: false },
                                  { content: "Cookie", isCorrect: false },
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
    lessonId = course.chapters[0].lessons[0].id;
    quizId = course.chapters[0].lessons[0].quiz!.id;

    // 4. Enroll Student
    await prisma.enrollment.create({
      data: {
        studentId: enrolledStudentId,
        courseId,
        status: EnrollmentStatus.ACTIVE,
      },
    });
  });

  afterAll(async () => {
    // Scoped cleanup
    await prisma.answer.deleteMany({
      where: {
        question: {
          quizId,
        },
      },
    });
    await prisma.question.deleteMany({
      where: { quizId },
    });
    await prisma.quiz.deleteMany({
      where: { id: quizId },
    });
    await prisma.video.deleteMany({
      where: { lessonId },
    });
    await prisma.lesson.deleteMany({
      where: { id: lessonId },
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
            enrolledStudentId,
            nonEnrolledStudentId,
            adminId,
          ],
        },
      },
    });
    await prisma.$disconnect();
  });

  // ---------------------------------------------------------------------------
  // 1. Quiz Details Answer DTO Masking [BR-QZ-06]
  // ---------------------------------------------------------------------------
  describe("GET /quizzes/:id - Answer DTO Masking [BR-QZ-06]", () => {
    it("should strictly omit isCorrect from answers when requested by an enrolled STUDENT [BR-QZ-06]", async () => {
      const quiz = await quizzesService.findOneQuiz(
        enrolledStudentId,
        Role.STUDENT,
        quizId,
      );

      expect(quiz).toBeDefined();
      expect(quiz.id).toBe(quizId);
      expect(quiz.questions.length).toBeGreaterThanOrEqual(1);

      const firstQuestion = quiz.questions[0];
      expect(firstQuestion.answers.length).toBe(3);

      firstQuestion.answers.forEach((ans: any) => {
        expect(ans).toHaveProperty("id");
        expect(ans).toHaveProperty("content");
        // CRITICAL SECURITY ASSERTION: isCorrect must be undefined for Student
        expect(ans.isCorrect).toBeUndefined();
      });
    });

    it("should include isCorrect in answers when requested by course owner TEACHER [BR-QZ-06]", async () => {
      const quiz = await quizzesService.findOneQuiz(
        teacherOwnerId,
        Role.TEACHER,
        quizId,
      );

      expect(quiz).toBeDefined();
      const firstQuestion = quiz.questions[0];
      firstQuestion.answers.forEach((ans: any) => {
        expect(ans).toHaveProperty("isCorrect");
        expect(typeof ans.isCorrect).toBe("boolean");
      });

      const correctAnswer = firstQuestion.answers.find((a: any) => a.isCorrect === true);
      expect(correctAnswer).toBeDefined();
      expect(correctAnswer.content).toBe("Authorization");
    });

    it("should include isCorrect in answers when requested by ADMIN [BR-QZ-06]", async () => {
      const quiz = await quizzesService.findOneQuiz(
        adminId,
        Role.ADMIN,
        quizId,
      );

      expect(quiz).toBeDefined();
      const firstQuestion = quiz.questions[0];
      firstQuestion.answers.forEach((ans: any) => {
        expect(ans).toHaveProperty("isCorrect");
      });
    });

    it("should reject non-enrolled student with 403 Forbidden", async () => {
      await expect(
        quizzesService.findOneQuiz(
          nonEnrolledStudentId,
          Role.STUDENT,
          quizId,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it("should reject non-owner teacher with 403 Forbidden", async () => {
      await expect(
        quizzesService.findOneQuiz(
          teacherOtherId,
          Role.TEACHER,
          quizId,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it("should throw 404 NotFoundException if quiz does not exist", async () => {
      await expect(
        quizzesService.findOneQuiz(
          enrolledStudentId,
          Role.STUDENT,
          "00000000-0000-0000-0000-000000000000",
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Lesson Details Masking via GET /lessons/:id [BR-QZ-06]
  // ---------------------------------------------------------------------------
  describe("GET /lessons/:id - Quiz Masking Integration [BR-QZ-06]", () => {
    it("should mask isCorrect on attached quiz answers when student views lesson details", async () => {
      const studentUser = {
        id: enrolledStudentId,
        email: "student@eduhub.test",
        role: Role.STUDENT,
      };

      const lesson = await lessonsService.findOne(lessonId, studentUser as any);

      expect(lesson).toBeDefined();
      expect(lesson.quiz).toBeDefined();
      expect(lesson.quiz?.questions).toBeDefined();

      const questions = lesson.quiz!.questions;
      expect(questions.length).toBeGreaterThanOrEqual(1);

      questions[0].answers.forEach((ans: any) => {
        expect(ans.isCorrect).toBeUndefined();
      });
    });

    it("should reveal isCorrect on attached quiz answers when teacher owner views lesson details", async () => {
      const teacherUser = {
        id: teacherOwnerId,
        email: "teacher@eduhub.test",
        role: Role.TEACHER,
      };

      const lesson = await lessonsService.findOne(lessonId, teacherUser as any);

      expect(lesson).toBeDefined();
      expect(lesson.quiz).toBeDefined();

      const questions = lesson.quiz!.questions;
      questions[0].answers.forEach((ans: any) => {
        expect(ans).toHaveProperty("isCorrect");
        expect(typeof ans.isCorrect).toBe("boolean");
      });
    });
  });
});
