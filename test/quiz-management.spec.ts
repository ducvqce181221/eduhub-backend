import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { QuizzesService } from "../src/quizzes/quizzes.service";
import { createPrismaClient } from "../src/lib/prisma";
import type { PrismaClient } from "../src/generated/prisma/client";
import {
  CourseStatus,
  Role,
} from "../src/generated/prisma/client";

describe("Phase 7 - Part 1: Quiz Management & Question/Answer CRUD (TDD Test Suite)", () => {
  let prisma: PrismaClient;
  let quizzesService: QuizzesService;

  let activeCategoryId: string;
  let teacherOwnerId: string;
  let teacherOtherId: string;
  let studentId: string;
  let adminId: string;

  let courseId: string;
  let lesson1Id: string;
  let lesson2Id: string;
  let createdQuizId: string;
  let createdQuestionId: string;

  const timestamp = Date.now();

  beforeAll(async () => {
    prisma = createPrismaClient();
    await prisma.$connect();

    quizzesService = new QuizzesService(prisma as any);

    // 1. Create Category
    const category = await prisma.category.create({
      data: {
        name: `QuizCat_${timestamp}`,
        slug: `quiz-cat-${timestamp}`,
        isActive: true,
      },
    });
    activeCategoryId = category.id;

    // 2. Create Users
    const teacherOwner = await prisma.user.create({
      data: {
        email: `teacher_owner_qz_${timestamp}@eduhub.test`,
        passwordHash: "hashed_pwd",
        fullName: "Quiz Teacher Owner",
        role: Role.TEACHER,
      },
    });
    teacherOwnerId = teacherOwner.id;

    const teacherOther = await prisma.user.create({
      data: {
        email: `teacher_other_qz_${timestamp}@eduhub.test`,
        passwordHash: "hashed_pwd",
        fullName: "Quiz Teacher Other",
        role: Role.TEACHER,
      },
    });
    teacherOtherId = teacherOther.id;

    const student = await prisma.user.create({
      data: {
        email: `student_qz_${timestamp}@eduhub.test`,
        passwordHash: "hashed_pwd",
        fullName: "Quiz Student",
        role: Role.STUDENT,
      },
    });
    studentId = student.id;

    const admin = await prisma.user.create({
      data: {
        email: `admin_qz_${timestamp}@eduhub.test`,
        passwordHash: "hashed_pwd",
        fullName: "Quiz Admin",
        role: Role.ADMIN,
      },
    });
    adminId = admin.id;

    // 3. Create Course with 2 lessons
    const course = await prisma.course.create({
      data: {
        title: "Quiz Management Course",
        slug: `quiz-mgmt-course-${timestamp}`,
        categoryId: activeCategoryId,
        teacherId: teacherOwnerId,
        status: CourseStatus.DRAFT,
        chapters: {
          create: [
            {
              title: "Chapter 1",
              order: 1,
              lessons: {
                create: [
                  {
                    title: "Lesson 1 for Quiz",
                    order: 1,
                  },
                  {
                    title: "Lesson 2 for Quiz",
                    order: 2,
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
    const sortedLessons = [...course.chapters[0].lessons].sort(
      (a, b) => a.order - b.order,
    );
    lesson1Id = sortedLessons[0].id;
    lesson2Id = sortedLessons[1].id;
  });

  afterAll(async () => {
    // Clean up scoped to this test suite
    await prisma.quizAttemptAnswer.deleteMany({
      where: {
        attempt: {
          studentId,
        },
      },
    });
    await prisma.quizAttempt.deleteMany({
      where: {
        studentId,
      },
    });
    await prisma.answer.deleteMany({
      where: {
        question: {
          quiz: {
            lesson: {
              chapter: {
                courseId,
              },
            },
          },
        },
      },
    });
    await prisma.question.deleteMany({
      where: {
        quiz: {
          lesson: {
            chapter: {
              courseId,
            },
          },
        },
      },
    });
    await prisma.quiz.deleteMany({
      where: {
        lesson: {
          chapter: {
            courseId,
          },
        },
      },
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
          in: [teacherOwnerId, teacherOtherId, studentId, adminId],
        },
      },
    });
    await prisma.$disconnect();
  });

  // ---------------------------------------------------------------------------
  // 1. Quiz Creation & Constraints [BR-QZ-01, BR-QZ-02]
  // ---------------------------------------------------------------------------
  describe("Quiz Creation & PassScore Validation [BR-QZ-01, BR-QZ-02]", () => {
    it("should allow course owner teacher to create a quiz with valid passScore [BR-QZ-02]", async () => {
      const quiz = await quizzesService.createQuiz(
        teacherOwnerId,
        Role.TEACHER,
        lesson1Id,
        {
          title: "Introduction Quiz",
          description: "Test your basic knowledge",
          passScore: 80,
        },
      );

      expect(quiz).toBeDefined();
      expect(quiz.id).toBeDefined();
      expect(quiz.lessonId).toBe(lesson1Id);
      expect(quiz.title).toBe("Introduction Quiz");
      expect(quiz.passScore).toBe(80);
      createdQuizId = quiz.id;
    });

    it("should reject creating a second quiz on the same lesson with 409 Conflict [BR-QZ-01]", async () => {
      await expect(
        quizzesService.createQuiz(
          teacherOwnerId,
          Role.TEACHER,
          lesson1Id,
          {
            title: "Duplicate Quiz",
            passScore: 80,
          },
        ),
      ).rejects.toThrow(ConflictException);
    });

    it("should reject quiz creation with passScore > 100 with 400 Bad Request [BR-QZ-02]", async () => {
      await expect(
        quizzesService.createQuiz(
          teacherOwnerId,
          Role.TEACHER,
          lesson2Id,
          {
            title: "Invalid PassScore Quiz",
            passScore: 105,
          },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("should reject quiz creation with passScore < 1 with 400 Bad Request [BR-QZ-02]", async () => {
      await expect(
        quizzesService.createQuiz(
          teacherOwnerId,
          Role.TEACHER,
          lesson2Id,
          {
            title: "Invalid PassScore Quiz",
            passScore: 0,
          },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("should reject non-owner teacher from creating quiz with 403 Forbidden", async () => {
      await expect(
        quizzesService.createQuiz(
          teacherOtherId,
          Role.TEACHER,
          lesson2Id,
          {
            title: "Unauthorized Quiz",
            passScore: 80,
          },
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it("should allow Admin to create a quiz for any lesson", async () => {
      const quiz = await quizzesService.createQuiz(
        adminId,
        Role.ADMIN,
        lesson2Id,
        {
          title: "Admin Created Quiz",
          passScore: 75,
        },
      );

      expect(quiz).toBeDefined();
      expect(quiz.passScore).toBe(75);

      // Clean up lesson2 quiz so we can test other scenarios if needed
      await quizzesService.deleteQuiz(adminId, Role.ADMIN, quiz.id);
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Quiz Update & Delete
  // ---------------------------------------------------------------------------
  describe("Quiz Update & Delete", () => {
    it("should update quiz title, description, and passScore", async () => {
      const updated = await quizzesService.updateQuiz(
        teacherOwnerId,
        Role.TEACHER,
        createdQuizId,
        {
          title: "Updated Quiz Title",
          description: "Updated description",
          passScore: 85,
        },
      );

      expect(updated.title).toBe("Updated Quiz Title");
      expect(updated.passScore).toBe(85);
    });

    it("should reject updating quiz with invalid passScore (> 100 or < 1)", async () => {
      await expect(
        quizzesService.updateQuiz(
          teacherOwnerId,
          Role.TEACHER,
          createdQuizId,
          {
            passScore: 150,
          },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("should reject non-owner from updating quiz with 403 Forbidden", async () => {
      await expect(
        quizzesService.updateQuiz(
          teacherOtherId,
          Role.TEACHER,
          createdQuizId,
          {
            title: "Hacked Title",
          },
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Question & Answer Validation and CRUD [BR-QZ-03]
  // ---------------------------------------------------------------------------
  describe("Question & Answer CRUD and Validation [BR-QZ-03]", () => {
    it("should add a question with valid answers (>= 2 answers, exactly 1 correct) [BR-QZ-03]", async () => {
      const question = await quizzesService.addQuestion(
        teacherOwnerId,
        Role.TEACHER,
        createdQuizId,
        {
          content: "What is the capital of Vietnam?",
          points: 10,
          order: 1,
          answers: [
            { content: "Hanoi", isCorrect: true },
            { content: "Ho Chi Minh City", isCorrect: false },
            { content: "Da Nang", isCorrect: false },
          ],
        },
      );

      expect(question).toBeDefined();
      expect(question.id).toBeDefined();
      expect(question.content).toBe("What is the capital of Vietnam?");
      expect(question.points).toBe(10);
      expect(question.answers.length).toBe(3);
      createdQuestionId = question.id;
    });

    it("should reject question creation if fewer than 2 answers are provided with 400 Bad Request [BR-QZ-03]", async () => {
      await expect(
        quizzesService.addQuestion(
          teacherOwnerId,
          Role.TEACHER,
          createdQuizId,
          {
            content: "Invalid question with only 1 answer",
            points: 5,
            answers: [{ content: "Only Answer", isCorrect: true }],
          },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("should reject question creation if no answers are marked isCorrect=true with 400 Bad Request [BR-QZ-03]", async () => {
      await expect(
        quizzesService.addQuestion(
          teacherOwnerId,
          Role.TEACHER,
          createdQuizId,
          {
            content: "No correct answer provided",
            points: 5,
            answers: [
              { content: "Choice A", isCorrect: false },
              { content: "Choice B", isCorrect: false },
            ],
          },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("should reject question creation if multiple answers are marked isCorrect=true with 400 Bad Request [BR-QZ-03]", async () => {
      await expect(
        quizzesService.addQuestion(
          teacherOwnerId,
          Role.TEACHER,
          createdQuizId,
          {
            content: "Multiple correct answers on single-choice question",
            points: 5,
            answers: [
              { content: "Choice A", isCorrect: true },
              { content: "Choice B", isCorrect: true },
            ],
          },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("should reject question creation with points < 1 with 400 Bad Request [BR-QZ-03]", async () => {
      await expect(
        quizzesService.addQuestion(
          teacherOwnerId,
          Role.TEACHER,
          createdQuizId,
          {
            content: "Zero points question",
            points: 0,
            answers: [
              { content: "Choice A", isCorrect: true },
              { content: "Choice B", isCorrect: false },
            ],
          },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("should update question content, points, and replace answers atomically", async () => {
      const updated = await quizzesService.updateQuestion(
        teacherOwnerId,
        Role.TEACHER,
        createdQuestionId,
        {
          content: "Updated question content?",
          points: 15,
          answers: [
            { content: "Updated Correct", isCorrect: true },
            { content: "Updated Wrong", isCorrect: false },
          ],
        },
      );

      expect(updated.content).toBe("Updated question content?");
      expect(updated.points).toBe(15);
      expect(updated.answers.length).toBe(2);
    });

    it("should delete question and its cascading answers", async () => {
      // Add a second question to test deletion
      const q2 = await quizzesService.addQuestion(
        teacherOwnerId,
        Role.TEACHER,
        createdQuizId,
        {
          content: "Temporary Question for Deletion",
          points: 5,
          answers: [
            { content: "Yes", isCorrect: true },
            { content: "No", isCorrect: false },
          ],
        },
      );

      await quizzesService.deleteQuestion(
        teacherOwnerId,
        Role.TEACHER,
        q2.id,
      );

      const count = await prisma.question.count({
        where: { id: q2.id },
      });
      expect(count).toBe(0);
    });
  });
});
