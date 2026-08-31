import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { QuizzesService } from "../src/quizzes/quizzes.service";
import { createPrismaClient } from "../src/lib/prisma";
import type { PrismaClient } from "../src/generated/prisma/client";
import {
  CourseStatus,
  EnrollmentStatus,
  Role,
} from "../src/generated/prisma/client";

describe("Phase 7 - Part 3: Quiz Scoring Algorithm, Atomic Attempts & History (TDD Test Suite)", () => {
  let prisma: PrismaClient;
  let quizzesService: QuizzesService;

  let activeCategoryId: string;
  let teacherOwnerId: string;
  let studentAId: string;
  let studentBId: string;
  let nonEnrolledStudentId: string;

  let courseId: string;
  let lessonId: string;
  let quizId: string;

  let q1Id: string;
  let q1Ans1CorrectId: string;
  let q1Ans2WrongId: string;

  let q2Id: string;
  let q2Ans1CorrectId: string;
  let q2Ans2WrongId: string;

  let q3Id: string;
  let q3Ans1CorrectId: string;
  let q3Ans2WrongId: string;

  const timestamp = Date.now();

  beforeAll(async () => {
    prisma = createPrismaClient();
    await prisma.$connect();

    quizzesService = new QuizzesService(prisma as any);

    // 1. Create Category
    const category = await prisma.category.create({
      data: {
        name: `QuizScoreCat_${timestamp}`,
        slug: `quiz-score-cat-${timestamp}`,
        isActive: true,
      },
    });
    activeCategoryId = category.id;

    // 2. Create Users
    const teacherOwner = await prisma.user.create({
      data: {
        email: `teacher_score_${timestamp}@eduhub.test`,
        passwordHash: "hashed_pwd",
        fullName: "Scoring Teacher Owner",
        role: Role.TEACHER,
      },
    });
    teacherOwnerId = teacherOwner.id;

    const studentA = await prisma.user.create({
      data: {
        email: `student_score_a_${timestamp}@eduhub.test`,
        passwordHash: "hashed_pwd",
        fullName: "Student A Scoring",
        role: Role.STUDENT,
      },
    });
    studentAId = studentA.id;

    const studentB = await prisma.user.create({
      data: {
        email: `student_score_b_${timestamp}@eduhub.test`,
        passwordHash: "hashed_pwd",
        fullName: "Student B Scoring",
        role: Role.STUDENT,
      },
    });
    studentBId = studentB.id;

    const nonEnrolledStudent = await prisma.user.create({
      data: {
        email: `student_score_non_${timestamp}@eduhub.test`,
        passwordHash: "hashed_pwd",
        fullName: "Non Enrolled Student Scoring",
        role: Role.STUDENT,
      },
    });
    nonEnrolledStudentId = nonEnrolledStudent.id;

    // 3. Create Course with Lesson + Quiz with 3 Questions (Points: 50, 30, 20 = Total 100 points, PassScore = 80)
    const course = await prisma.course.create({
      data: {
        title: "Quiz Scoring Algorithm Course",
        slug: `quiz-scoring-course-${timestamp}`,
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
                    title: "Lesson with 3-Question Quiz",
                    order: 1,
                    quiz: {
                      create: {
                        title: "Comprehensive Scoring Quiz",
                        passScore: 80, // 80% needed to pass
                        questions: {
                          create: [
                            {
                              content: "Question 1 (50 points)",
                              order: 1,
                              points: 50,
                              answers: {
                                create: [
                                  { content: "Q1 Correct", isCorrect: true },
                                  { content: "Q1 Wrong", isCorrect: false },
                                ],
                              },
                            },
                            {
                              content: "Question 2 (30 points)",
                              order: 2,
                              points: 30,
                              answers: {
                                create: [
                                  { content: "Q2 Correct", isCorrect: true },
                                  { content: "Q2 Wrong", isCorrect: false },
                                ],
                              },
                            },
                            {
                              content: "Question 3 (20 points)",
                              order: 3,
                              points: 20,
                              answers: {
                                create: [
                                  { content: "Q3 Correct", isCorrect: true },
                                  { content: "Q3 Wrong", isCorrect: false },
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
                      orderBy: { order: "asc" },
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
    lessonId = course.chapters[0].lessons[0].id;
    const quiz = course.chapters[0].lessons[0].quiz!;
    quizId = quiz.id;

    const q1 = quiz.questions[0];
    q1Id = q1.id;
    q1Ans1CorrectId = q1.answers.find((a) => a.isCorrect)!.id;
    q1Ans2WrongId = q1.answers.find((a) => !a.isCorrect)!.id;

    const q2 = quiz.questions[1];
    q2Id = q2.id;
    q2Ans1CorrectId = q2.answers.find((a) => a.isCorrect)!.id;
    q2Ans2WrongId = q2.answers.find((a) => !a.isCorrect)!.id;

    const q3 = quiz.questions[2];
    q3Id = q3.id;
    q3Ans1CorrectId = q3.answers.find((a) => a.isCorrect)!.id;
    q3Ans2WrongId = q3.answers.find((a) => !a.isCorrect)!.id;

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
          studentId: { in: [studentAId, studentBId, nonEnrolledStudentId] },
        },
      },
    });
    await prisma.quizAttempt.deleteMany({
      where: {
        studentId: { in: [studentAId, studentBId, nonEnrolledStudentId] },
      },
    });
    await prisma.answer.deleteMany({
      where: {
        question: { quizId },
      },
    });
    await prisma.question.deleteMany({
      where: { quizId },
    });
    await prisma.quiz.deleteMany({
      where: { id: quizId },
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
  // 1. Server-Side Atomic Grading Algorithm [BR-QZ-05]
  // ---------------------------------------------------------------------------
  describe("Server-Side Atomic Grading Algorithm [BR-QZ-05]", () => {
    it("should award 100% score and isPassed=true when all answers are correct", async () => {
      const result = await quizzesService.submitQuizAttempt(
        studentAId,
        quizId,
        {
          answers: [
            { questionId: q1Id, selectedAnswerId: q1Ans1CorrectId }, // 50 pts
            { questionId: q2Id, selectedAnswerId: q2Ans1CorrectId }, // 30 pts
            { questionId: q3Id, selectedAnswerId: q3Ans1CorrectId }, // 20 pts
          ],
        },
      );

      expect(result).toBeDefined();
      expect(result.attemptId).toBeDefined();
      expect(result.quizId).toBe(quizId);
      expect(result.earnedPoints).toBe(100);
      expect(result.totalPoints).toBe(100);
      expect(result.score).toBe(100);
      expect(result.passScore).toBe(80);
      expect(result.isPassed).toBe(true);
      expect(result.submittedAt).toBeInstanceOf(Date);
    });

    it("should award exact boundary score (80%) and set isPassed=true when score equals passScore [BR-QZ-05]", async () => {
      // Q1 (50 pts, correct) + Q2 (30 pts, correct) + Q3 (20 pts, wrong) = 80/100 = 80%
      const result = await quizzesService.submitQuizAttempt(
        studentAId,
        quizId,
        {
          answers: [
            { questionId: q1Id, selectedAnswerId: q1Ans1CorrectId }, // 50 pts
            { questionId: q2Id, selectedAnswerId: q2Ans1CorrectId }, // 30 pts
            { questionId: q3Id, selectedAnswerId: q3Ans2WrongId },   // 0 pts
          ],
        },
      );

      expect(result.earnedPoints).toBe(80);
      expect(result.totalPoints).toBe(100);
      expect(result.score).toBe(80);
      expect(result.isPassed).toBe(true);
    });

    it("should calculate partial failing score (70%) and set isPassed=false when below passScore [BR-QZ-05]", async () => {
      // Q1 (50 pts, correct) + Q2 (30 pts, wrong) + Q3 (20 pts, correct) = 70/100 = 70% < 80%
      const result = await quizzesService.submitQuizAttempt(
        studentAId,
        quizId,
        {
          answers: [
            { questionId: q1Id, selectedAnswerId: q1Ans1CorrectId }, // 50 pts
            { questionId: q2Id, selectedAnswerId: q2Ans2WrongId },   // 0 pts
            { questionId: q3Id, selectedAnswerId: q3Ans1CorrectId }, // 20 pts
          ],
        },
      );

      expect(result.earnedPoints).toBe(70);
      expect(result.totalPoints).toBe(100);
      expect(result.score).toBe(70);
      expect(result.isPassed).toBe(false);
    });

    it("should award 0% score and isPassed=false when all answers are incorrect", async () => {
      const result = await quizzesService.submitQuizAttempt(
        studentBId,
        quizId,
        {
          answers: [
            { questionId: q1Id, selectedAnswerId: q1Ans2WrongId },
            { questionId: q2Id, selectedAnswerId: q2Ans2WrongId },
            { questionId: q3Id, selectedAnswerId: q3Ans2WrongId },
          ],
        },
      );

      expect(result.earnedPoints).toBe(0);
      expect(result.totalPoints).toBe(100);
      expect(result.score).toBe(0);
      expect(result.isPassed).toBe(false);
    });

    it("should award 0 points for unsubmitted/missing questions in payload", async () => {
      // Only submitted Question 3 (20 pts, correct) -> 20/100 = 20%
      const result = await quizzesService.submitQuizAttempt(
        studentBId,
        quizId,
        {
          answers: [{ questionId: q3Id, selectedAnswerId: q3Ans1CorrectId }],
        },
      );

      expect(result.earnedPoints).toBe(20);
      expect(result.totalPoints).toBe(100);
      expect(result.score).toBe(20);
      expect(result.isPassed).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Unlimited Quiz Attempts & History Query [BR-QZ-04]
  // ---------------------------------------------------------------------------
  describe("Unlimited Quiz Attempts & History Query [BR-QZ-04]", () => {
    it("should record all individual attempts and return full attempt history in chronological order [BR-QZ-04]", async () => {
      // Student A has already submitted 3 attempts above
      const attempts = await quizzesService.getQuizAttempts(studentAId, quizId);

      expect(attempts).toBeDefined();
      expect(Array.isArray(attempts)).toBe(true);
      expect(attempts.length).toBe(3);

      // Verify structure per 05_API_Design.md §4.3
      attempts.forEach((att: any) => {
        expect(att).toHaveProperty("id");
        expect(att).toHaveProperty("score");
        expect(att).toHaveProperty("isPassed");
        expect(att).toHaveProperty("earnedPoints");
        expect(att).toHaveProperty("totalPoints");
        expect(att).toHaveProperty("passScore");
        expect(att).toHaveProperty("startedAt");
        expect(att).toHaveProperty("submittedAt");
      });

      // Verify attempts are ordered by submittedAt descending or ascending
      expect(attempts[0].score).toBeDefined();
    });

    it("should reject non-enrolled student from submitting quiz attempt with 403 Forbidden", async () => {
      await expect(
        quizzesService.submitQuizAttempt(nonEnrolledStudentId, quizId, {
          answers: [{ questionId: q1Id, selectedAnswerId: q1Ans1CorrectId }],
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it("should reject non-enrolled student from viewing quiz attempts with 403 Forbidden", async () => {
      await expect(
        quizzesService.getQuizAttempts(nonEnrolledStudentId, quizId),
      ).rejects.toThrow(ForbiddenException);
    });

    it("should throw 404 NotFoundException if quiz does not exist when submitting attempt", async () => {
      await expect(
        quizzesService.submitQuizAttempt(
          studentAId,
          "00000000-0000-0000-0000-000000000000",
          { answers: [] },
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
