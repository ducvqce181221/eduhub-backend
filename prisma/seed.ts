import { createPrismaClient } from "../src/lib/prisma";
import bcrypt from "bcryptjs";
import { cleanDatabase } from "./seeds/clean.seed";
import { seedUsers } from "./seeds/users.seed";
import { seedCategories } from "./seeds/categories.seed";
import { seedCourses } from "./seeds/courses.seed";
import { seedEnrollmentsAndProgress } from "./seeds/enrollments.seed";
import { seedNotifications } from "./seeds/notifications.seed";

const prisma = createPrismaClient();

async function main() {
  console.log("🌱 ===================================================");
  console.log("🌱 Starting EduHub Full Database Seeding...");
  console.log("🌱 ===================================================");

  const startTime = Date.now();

  // 1. Clean previous database state
  await cleanDatabase(prisma);

  // 2. Hash default password for all seeded accounts (conforms to BR-USR-05)
  const passwordHash = bcrypt.hashSync("Password123!", 10);

  // 3. Seed Users
  const users = await seedUsers(prisma, passwordHash);

  // 4. Seed Categories
  const categories = await seedCategories(prisma);

  // 5. Seed Courses & Curriculum (Chapters, Lessons, Videos, Resources, Quizzes)
  const courses = await seedCourses(prisma, users, categories);

  // 6. Seed Enrollments, Learning Progress, and Quiz Attempts
  await seedEnrollmentsAndProgress(prisma, users, courses);

  // 7. Seed Notifications
  await seedNotifications(prisma, users, courses);

  // Summary counts
  const [
    userCount,
    categoryCount,
    courseCount,
    chapterCount,
    lessonCount,
    videoCount,
    resourceCount,
    quizCount,
    questionCount,
    answerCount,
    enrollmentCount,
    progressCount,
    attemptCount,
    notificationCount,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.category.count(),
    prisma.course.count(),
    prisma.chapter.count(),
    prisma.lesson.count(),
    prisma.video.count(),
    prisma.resource.count(),
    prisma.quiz.count(),
    prisma.question.count(),
    prisma.answer.count(),
    prisma.enrollment.count(),
    prisma.lessonProgress.count(),
    prisma.quizAttempt.count(),
    prisma.notification.count(),
  ]);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log("===================================================");
  console.log(`🎉 Database Seeding Completed in ${elapsed}s!`);
  console.log("📊 Summary of Seeded Entities:");
  console.log(`   - Users:              ${userCount} (1 Admin, 3 Teachers, 5 Students, 1 Deactivated)`);
  console.log(`   - Categories:         ${categoryCount} (4 Active with courses, 1 Empty deletable, 1 Inactive)`);
  console.log(`   - Courses:            ${courseCount} (4 Published, 1 Draft invalid, 1 Draft ready, 1 Archived)`);
  console.log(`   - Chapters:           ${chapterCount}`);
  console.log(`   - Lessons:            ${lessonCount}`);
  console.log(`   - Videos:             ${videoCount}`);
  console.log(`   - Resources:          ${resourceCount}`);
  console.log(`   - Quizzes:            ${quizCount}`);
  console.log(`   - Questions:          ${questionCount}`);
  console.log(`   - Answers:            ${answerCount}`);
  console.log(`   - Enrollments:        ${enrollmentCount}`);
  console.log(`   - Lesson Progress:    ${progressCount}`);
  console.log(`   - Quiz Attempts:      ${attemptCount}`);
  console.log(`   - Notifications:      ${notificationCount}`);
  console.log("===================================================");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error("❌ Seeding failed:", error);
    await prisma.$disconnect();
    process.exit(1);
  });
