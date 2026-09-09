import { PrismaClient } from "../../src/generated/prisma/client";
import { SeededUsers } from "./users.seed";
import { SeededCourses } from "./courses.seed";

export async function seedEnrollmentsAndProgress(
  prisma: PrismaClient,
  users: SeededUsers,
  courses: SeededCourses,
) {
  console.log("🎓 Seeding enrollments, learning progress, and quiz attempts...");

  const now = Date.now();
  const DAY_MS = 24 * 60 * 60 * 1000;

  // Shortcuts to course 1 lessons
  const c1_ch1_l1 = courses.course1.chapters[0].lessons[0]; // Video 600s + Quiz
  const c1_ch1_l2 = courses.course1.chapters[0].lessons[1]; // Video 480s
  const c1_ch2_l3 = courses.course1.chapters[1].lessons[0]; // Video 720s + Quiz
  const c1_ch2_l4 = courses.course1.chapters[1].lessons[1]; // Video 540s

  const c1_quiz1 = c1_ch1_l1.quiz!;
  const c1_quiz1_q1 = c1_quiz1.questions[0];
  const c1_quiz1_q1_correct = c1_quiz1_q1.answers.find((a) => a.isCorrect)!;
  const c1_quiz1_q1_wrong = c1_quiz1_q1.answers.find((a) => !a.isCorrect)!;

  const c1_quiz1_q2 = c1_quiz1.questions[1];
  const c1_quiz1_q2_correct = c1_quiz1_q2.answers.find((a) => a.isCorrect)!;
  const c1_quiz1_q2_wrong = c1_quiz1_q2.answers.find((a) => !a.isCorrect)!;

  const c1_quiz2 = c1_ch2_l3.quiz!;
  const c1_quiz2_q1 = c1_quiz2.questions[0];
  const c1_quiz2_q1_correct = c1_quiz2_q1.answers.find((a) => a.isCorrect)!;

  const c1_quiz2_q2 = c1_quiz2.questions[1];
  const c1_quiz2_q2_correct = c1_quiz2_q2.answers.find((a) => a.isCorrect)!;

  // Shortcuts to course 2 lessons
  const c2_ch1_l1 = courses.course2.chapters[0].lessons[0]; // Video 360s
  const c2_ch1_l2 = courses.course2.chapters[0].lessons[1]; // Video 420s + Quiz
  const c2_ch2_l3 = courses.course2.chapters[1].lessons[0]; // Video 600s

  // Shortcuts to course 3 lessons
  const c3_ch1_l1 = courses.course3.chapters[0].lessons[0]; // Video 450s + Quiz

  // Shortcuts to course 7 lessons
  const c7_ch1_l1 = courses.course7.chapters[0].lessons[0]; // Video 450s

  // ============================================================================
  // 1. Alice Learner (student1): Active in Course 1 (~50% progress, quiz history)
  // ============================================================================
  await prisma.enrollment.create({
    data: {
      studentId: users.student1.id,
      courseId: courses.course1.id,
      status: "ACTIVE",
      enrolledAt: new Date(now - 14 * DAY_MS),
    },
  });

  // Quiz Attempt 1 (Failed: 50% < 80% passScore)
  const aliceAttempt1 = await prisma.quizAttempt.create({
    data: {
      quizId: c1_quiz1.id,
      studentId: users.student1.id,
      score: 50.0,
      isPassed: false,
      startedAt: new Date(now - 10 * DAY_MS),
      submittedAt: new Date(now - 10 * DAY_MS + 5 * 60 * 1000),
    },
  });

  await prisma.quizAttemptAnswer.createMany({
    data: [
      {
        attemptId: aliceAttempt1.id,
        questionId: c1_quiz1_q1.id,
        selectedAnswerId: c1_quiz1_q1_correct.id,
        isCorrect: true,
      },
      {
        attemptId: aliceAttempt1.id,
        questionId: c1_quiz1_q2.id,
        selectedAnswerId: c1_quiz1_q2_wrong.id,
        isCorrect: false,
      },
    ],
  });

  // Quiz Attempt 2 (Passed: 100% >= 80% passScore)
  const aliceAttempt2 = await prisma.quizAttempt.create({
    data: {
      quizId: c1_quiz1.id,
      studentId: users.student1.id,
      score: 100.0,
      isPassed: true,
      startedAt: new Date(now - 9 * DAY_MS),
      submittedAt: new Date(now - 9 * DAY_MS + 4 * 60 * 1000),
    },
  });

  await prisma.quizAttemptAnswer.createMany({
    data: [
      {
        attemptId: aliceAttempt2.id,
        questionId: c1_quiz1_q1.id,
        selectedAnswerId: c1_quiz1_q1_correct.id,
        isCorrect: true,
      },
      {
        attemptId: aliceAttempt2.id,
        questionId: c1_quiz1_q2.id,
        selectedAnswerId: c1_quiz1_q2_correct.id,
        isCorrect: true,
      },
    ],
  });

  // Lesson 1: 600s watched (100% >= 90%) + passed quiz -> isCompleted = true
  await prisma.lessonProgress.create({
    data: {
      studentId: users.student1.id,
      lessonId: c1_ch1_l1.id,
      watchedSeconds: 600,
      isCompleted: true,
      completedAt: new Date(now - 9 * DAY_MS),
    },
  });

  // Lesson 2: 450s watched (93.75% >= 90%), no quiz -> isCompleted = true
  await prisma.lessonProgress.create({
    data: {
      studentId: users.student1.id,
      lessonId: c1_ch1_l2.id,
      watchedSeconds: 450,
      isCompleted: true,
      completedAt: new Date(now - 8 * DAY_MS),
    },
  });

  // Lesson 3: 200s watched (27.7% < 90%), quiz not taken -> isCompleted = false
  await prisma.lessonProgress.create({
    data: {
      studentId: users.student1.id,
      lessonId: c1_ch2_l3.id,
      watchedSeconds: 200,
      isCompleted: false,
      completedAt: null,
    },
  });

  // ============================================================================
  // 2. Bob Scholar (student2): Completed Course 1 (100% progress, status COMPLETED)
  // ============================================================================
  await prisma.enrollment.create({
    data: {
      studentId: users.student2.id,
      courseId: courses.course1.id,
      status: "COMPLETED",
      enrolledAt: new Date(now - 25 * DAY_MS),
      completedAt: new Date(now - 5 * DAY_MS),
    },
  });

  // Bob Quiz 1 Attempt (Passed: 100%)
  const bobAttempt1 = await prisma.quizAttempt.create({
    data: {
      quizId: c1_quiz1.id,
      studentId: users.student2.id,
      score: 100.0,
      isPassed: true,
      startedAt: new Date(now - 20 * DAY_MS),
      submittedAt: new Date(now - 20 * DAY_MS + 3 * 60 * 1000),
    },
  });

  await prisma.quizAttemptAnswer.createMany({
    data: [
      {
        attemptId: bobAttempt1.id,
        questionId: c1_quiz1_q1.id,
        selectedAnswerId: c1_quiz1_q1_correct.id,
        isCorrect: true,
      },
      {
        attemptId: bobAttempt1.id,
        questionId: c1_quiz1_q2.id,
        selectedAnswerId: c1_quiz1_q2_correct.id,
        isCorrect: true,
      },
    ],
  });

  // Bob Quiz 2 Attempt (Passed: 100%)
  const bobAttempt2 = await prisma.quizAttempt.create({
    data: {
      quizId: c1_quiz2.id,
      studentId: users.student2.id,
      score: 100.0,
      isPassed: true,
      startedAt: new Date(now - 10 * DAY_MS),
      submittedAt: new Date(now - 10 * DAY_MS + 4 * 60 * 1000),
    },
  });

  await prisma.quizAttemptAnswer.createMany({
    data: [
      {
        attemptId: bobAttempt2.id,
        questionId: c1_quiz2_q1.id,
        selectedAnswerId: c1_quiz2_q1_correct.id,
        isCorrect: true,
      },
      {
        attemptId: bobAttempt2.id,
        questionId: c1_quiz2_q2.id,
        selectedAnswerId: c1_quiz2_q2_correct.id,
        isCorrect: true,
      },
    ],
  });

  // All 4 lessons completed for Bob
  await prisma.lessonProgress.createMany({
    data: [
      {
        studentId: users.student2.id,
        lessonId: c1_ch1_l1.id,
        watchedSeconds: 600,
        isCompleted: true,
        completedAt: new Date(now - 20 * DAY_MS),
      },
      {
        studentId: users.student2.id,
        lessonId: c1_ch1_l2.id,
        watchedSeconds: 480,
        isCompleted: true,
        completedAt: new Date(now - 15 * DAY_MS),
      },
      {
        studentId: users.student2.id,
        lessonId: c1_ch2_l3.id,
        watchedSeconds: 720,
        isCompleted: true,
        completedAt: new Date(now - 10 * DAY_MS),
      },
      {
        studentId: users.student2.id,
        lessonId: c1_ch2_l4.id,
        watchedSeconds: 540,
        isCompleted: true,
        completedAt: new Date(now - 5 * DAY_MS),
      },
    ],
  });

  // ============================================================================
  // 3. Charlie Newbie (student3): Enrolled in Course 2 with 0% progress
  // ============================================================================
  await prisma.enrollment.create({
    data: {
      studentId: users.student3.id,
      courseId: courses.course2.id,
      status: "ACTIVE",
      enrolledAt: new Date(now - 2 * DAY_MS),
    },
  });

  // ============================================================================
  // 4. David Veteran (student4): Enrolled in Archived Course 7 (tests BR-CRS-04)
  // ============================================================================
  await prisma.enrollment.create({
    data: {
      studentId: users.student4.id,
      courseId: courses.course7.id,
      status: "ACTIVE",
      enrolledAt: new Date(now - 60 * DAY_MS),
    },
  });

  await prisma.lessonProgress.create({
    data: {
      studentId: users.student4.id,
      lessonId: c7_ch1_l1.id,
      watchedSeconds: 450,
      isCompleted: true,
      completedAt: new Date(now - 50 * DAY_MS),
    },
  });

  // ============================================================================
  // 5. Eva Explorer (student5): Enrolled in multiple courses (Course 1, 2, 3)
  // ============================================================================
  // Eva in Course 1: 3/4 completed (75%)
  await prisma.enrollment.create({
    data: {
      studentId: users.student5.id,
      courseId: courses.course1.id,
      status: "ACTIVE",
      enrolledAt: new Date(now - 12 * DAY_MS),
    },
  });

  // Eva Quiz Attempt on Course 1 Quiz 1 (Passed: 100%)
  const evaAttempt1 = await prisma.quizAttempt.create({
    data: {
      quizId: c1_quiz1.id,
      studentId: users.student5.id,
      score: 100.0,
      isPassed: true,
      startedAt: new Date(now - 11 * DAY_MS),
      submittedAt: new Date(now - 11 * DAY_MS + 3 * 60 * 1000),
    },
  });

  await prisma.quizAttemptAnswer.createMany({
    data: [
      {
        attemptId: evaAttempt1.id,
        questionId: c1_quiz1_q1.id,
        selectedAnswerId: c1_quiz1_q1_correct.id,
        isCorrect: true,
      },
      {
        attemptId: evaAttempt1.id,
        questionId: c1_quiz1_q2.id,
        selectedAnswerId: c1_quiz1_q2_correct.id,
        isCorrect: true,
      },
    ],
  });

  // Eva Quiz Attempt on Course 1 Quiz 2 (Passed: 100%)
  const evaAttempt2 = await prisma.quizAttempt.create({
    data: {
      quizId: c1_quiz2.id,
      studentId: users.student5.id,
      score: 100.0,
      isPassed: true,
      startedAt: new Date(now - 4 * DAY_MS),
      submittedAt: new Date(now - 4 * DAY_MS + 2 * 60 * 1000),
    },
  });

  await prisma.quizAttemptAnswer.createMany({
    data: [
      {
        attemptId: evaAttempt2.id,
        questionId: c1_quiz2_q1.id,
        selectedAnswerId: c1_quiz2_q1_correct.id,
        isCorrect: true,
      },
      {
        attemptId: evaAttempt2.id,
        questionId: c1_quiz2_q2.id,
        selectedAnswerId: c1_quiz2_q2_correct.id,
        isCorrect: true,
      },
    ],
  });

  await prisma.lessonProgress.createMany({
    data: [
      {
        studentId: users.student5.id,
        lessonId: c1_ch1_l1.id,
        watchedSeconds: 600,
        isCompleted: true,
        completedAt: new Date(now - 11 * DAY_MS),
      },
      {
        studentId: users.student5.id,
        lessonId: c1_ch1_l2.id,
        watchedSeconds: 480,
        isCompleted: true,
        completedAt: new Date(now - 7 * DAY_MS),
      },
      {
        studentId: users.student5.id,
        lessonId: c1_ch2_l3.id,
        watchedSeconds: 720,
        isCompleted: true,
        completedAt: new Date(now - 4 * DAY_MS),
      },
    ],
  });

  // Eva in Course 2: 1/3 completed (33.3%)
  await prisma.enrollment.create({
    data: {
      studentId: users.student5.id,
      courseId: courses.course2.id,
      status: "ACTIVE",
      enrolledAt: new Date(now - 8 * DAY_MS),
    },
  });

  await prisma.lessonProgress.create({
    data: {
      studentId: users.student5.id,
      lessonId: c2_ch1_l1.id,
      watchedSeconds: 360,
      isCompleted: true,
      completedAt: new Date(now - 6 * DAY_MS),
    },
  });

  // Eva in Course 3: 0/2 completed (0%)
  await prisma.enrollment.create({
    data: {
      studentId: users.student5.id,
      courseId: courses.course3.id,
      status: "ACTIVE",
      enrolledAt: new Date(now - 3 * DAY_MS),
    },
  });

  console.log(
    "✓ Seeded enrollments and progress for Alice (50%), Bob (100% completed), Charlie (0%), David (Archived), and Eva (Multi-course).",
  );
}
