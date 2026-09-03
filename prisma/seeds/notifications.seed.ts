import { PrismaClient } from "../../src/generated/prisma/client";
import { SeededUsers } from "./users.seed";
import { SeededCourses } from "./courses.seed";

export async function seedNotifications(
  prisma: PrismaClient,
  users: SeededUsers,
  courses: SeededCourses,
) {
  console.log("🔔 Seeding notifications...");

  const now = Date.now();
  const DAY_MS = 24 * 60 * 60 * 1000;

  await prisma.notification.createMany({
    data: [
      // 1. Alice Learner (student1)
      {
        userId: users.student1.id,
        type: "COURSE_ENROLLED",
        title: "Welcome to Fullstack NestJS & Next.js Masterclass",
        message:
          "You have successfully enrolled in Fullstack NestJS & Next.js Masterclass. Start your journey with Chapter 1!",
        isRead: true,
        createdAt: new Date(now - 14 * DAY_MS),
        readAt: new Date(now - 14 * DAY_MS + 30 * 60 * 1000),
      },
      {
        userId: users.student1.id,
        type: "QUIZ_SUBMITTED",
        title: "Quiz Passed: NestJS Core Fundamentals Quiz",
        message:
          "Congratulations! You scored 100.0% and passed the NestJS Core Fundamentals Quiz. Lesson 1 has been marked completed!",
        isRead: false,
        createdAt: new Date(now - 9 * DAY_MS),
      },
      {
        userId: users.student1.id,
        type: "SYSTEM_BROADCAST",
        title: "Welcome to EduHub Platform!",
        message:
          "Explore cutting-edge engineering courses, interactive video players with heartbeat progress, and hands-on quizzes.",
        isRead: true,
        createdAt: new Date(now - 15 * DAY_MS),
        readAt: new Date(now - 12 * DAY_MS),
      },

      // 2. Bob Scholar (student2)
      {
        userId: users.student2.id,
        type: "COURSE_ENROLLED",
        title: "Welcome to Fullstack NestJS & Next.js Masterclass",
        message:
          "You have successfully enrolled in Fullstack NestJS & Next.js Masterclass.",
        isRead: true,
        createdAt: new Date(now - 25 * DAY_MS),
        readAt: new Date(now - 25 * DAY_MS + 10 * 60 * 1000),
      },
      {
        userId: users.student2.id,
        type: "QUIZ_SUBMITTED",
        title: "Quiz Passed: React Server Components Assessment",
        message:
          "Great job! You achieved a perfect score of 100.0% on the React Server Components Assessment.",
        isRead: true,
        createdAt: new Date(now - 10 * DAY_MS),
        readAt: new Date(now - 9 * DAY_MS),
      },
      {
        userId: users.student2.id,
        type: "COURSE_COMPLETED",
        title: "Course Completed: Fullstack NestJS & Next.js Masterclass",
        message:
          "Outstanding achievement! You have completed 100% of all curriculum lessons and assessments. Your completion is officially certified!",
        isRead: false,
        createdAt: new Date(now - 5 * DAY_MS),
      },
      {
        userId: users.student2.id,
        type: "SYSTEM_BROADCAST",
        title: "Welcome to EduHub Platform!",
        message:
          "Explore cutting-edge engineering courses, interactive video players, and quizzes.",
        isRead: true,
        createdAt: new Date(now - 20 * DAY_MS),
        readAt: new Date(now - 19 * DAY_MS),
      },

      // 3. Charlie Newbie (student3)
      {
        userId: users.student3.id,
        type: "COURSE_ENROLLED",
        title: "Welcome to Docker & Kubernetes for Modern Developers",
        message:
          "You have enrolled in Docker & Kubernetes for Modern Developers. Click 'Start Learning' to begin Lesson 1!",
        isRead: false,
        createdAt: new Date(now - 2 * DAY_MS),
      },

      // 4. System Broadcasts for Teachers & Admin
      {
        userId: users.teacher1.id,
        type: "SYSTEM_BROADCAST",
        title: "Scheduled Maintenance Notice",
        message:
          "EduHub infrastructure will undergo scheduled database indexing optimizations this Sunday at 02:00 UTC.",
        isRead: false,
        createdAt: new Date(now - 1 * DAY_MS),
      },
      {
        userId: users.teacher2.id,
        type: "SYSTEM_BROADCAST",
        title: "Scheduled Maintenance Notice",
        message:
          "EduHub infrastructure will undergo scheduled database indexing optimizations this Sunday at 02:00 UTC.",
        isRead: true,
        createdAt: new Date(now - 1 * DAY_MS),
        readAt: new Date(now - 12 * 60 * 60 * 1000),
      },
      {
        userId: users.admin.id,
        type: "SYSTEM_BROADCAST",
        title: "Platform Overview Report",
        message:
          "System metrics report: 7 courses seeded, 10 active personas, Redis cache-aside online.",
        isRead: false,
        createdAt: new Date(now - 6 * 60 * 60 * 1000),
      },
    ],
  });

  console.log(
    "✓ Seeded notifications across all types: COURSE_ENROLLED, QUIZ_SUBMITTED, COURSE_COMPLETED, SYSTEM_BROADCAST.",
  );
}
