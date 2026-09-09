import { PrismaClient } from "../../src/generated/prisma/client";

export async function cleanDatabase(prisma: PrismaClient) {
  console.log("🧹 Cleaning up database in reverse FK order...");

  // Delete in reverse dependency order
  await prisma.quizAttemptAnswer.deleteMany();
  await prisma.quizAttempt.deleteMany();
  await prisma.answer.deleteMany();
  await prisma.question.deleteMany();
  await prisma.quiz.deleteMany();
  await prisma.resource.deleteMany();
  await prisma.video.deleteMany();
  await prisma.lessonProgress.deleteMany();
  await prisma.lesson.deleteMany();
  await prisma.chapter.deleteMany();
  await prisma.enrollment.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.course.deleteMany();
  await prisma.category.deleteMany();
  await prisma.mediaAsset.deleteMany();
  await prisma.user.deleteMany();

  console.log("✓ Database clean complete.");
}
