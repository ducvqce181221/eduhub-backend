import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { BadRequestException } from "@nestjs/common";
import { ProgressService } from "../src/progress/progress.service";
import { createPrismaClient } from "../src/lib/prisma";
import type { PrismaClient } from "../src/generated/prisma/client";
import {
  CourseStatus,
  EnrollmentStatus,
  Role,
} from "../src/generated/prisma/client";

describe("Security: Video Progress Spoofing Prevention [BR-PRG-05]", () => {
  let prisma: PrismaClient;
  let progressService: ProgressService;

  let activeCategoryId: string;
  let teacherId: string;
  let studentId: string;
  let courseId: string;
  let lessonId: string;

  const timestamp = Date.now();
  const videoDuration = 1000; // 1000 seconds video

  beforeAll(async () => {
    prisma = createPrismaClient();
    await prisma.$connect();

    progressService = new ProgressService(prisma as any);

    const category = await prisma.category.create({
      data: {
        name: `SpoofCat_${timestamp}`,
        slug: `spoof-cat-${timestamp}`,
        isActive: true,
      },
    });
    activeCategoryId = category.id;

    const teacher = await prisma.user.create({
      data: {
        email: `teacher_spoof_${timestamp}@eduhub.test`,
        passwordHash: "hashed_pwd",
        fullName: "Spoof Teacher",
        role: Role.TEACHER,
      },
    });
    teacherId = teacher.id;

    const student = await prisma.user.create({
      data: {
        email: `student_spoof_${timestamp}@eduhub.test`,
        passwordHash: "hashed_pwd",
        fullName: "Spoof Student",
        role: Role.STUDENT,
      },
    });
    studentId = student.id;

    const course = await prisma.course.create({
      data: {
        title: "Anti Spoof Course",
        slug: `anti-spoof-course-${timestamp}`,
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
                        title: "Lesson 1 Video",
                        videoUrl: "https://media.local/videos/lesson1.mp4",
                        durationSeconds: videoDuration,
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
    lessonId = course.chapters[0].lessons[0].id;

    await prisma.enrollment.create({
      data: {
        studentId,
        courseId,
        status: EnrollmentStatus.ACTIVE,
      },
    });
  });

  afterAll(async () => {
    await prisma.lessonProgress.deleteMany({
      where: { studentId },
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
      where: { id: { in: [teacherId, studentId] } },
    });
    await prisma.$disconnect();
  });

  it("should reject instant spoofed jump to 900s without elapsed playback time", async () => {
    await expect(
      progressService.updateLessonProgress(studentId, lessonId, {
        watchedSeconds: 900,
        enforceDeltaCheck: true,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it("should accept valid initial progress within grace period (e.g. 15s)", async () => {
    const progress = await progressService.updateLessonProgress(
      studentId,
      lessonId,
      {
        watchedSeconds: 15,
        enforceDeltaCheck: true,
      },
    );

    expect(progress.watchedSeconds).toBe(15);
    expect(progress.isCompleted).toBe(false);
  });

  it("should reject an immediate large forward jump from 15s to 500s", async () => {
    await expect(
      progressService.updateLessonProgress(studentId, lessonId, {
        watchedSeconds: 500,
        enforceDeltaCheck: true,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it("should allow rewinding video from 15s to 5s without error", async () => {
    const progress = await progressService.updateLessonProgress(
      studentId,
      lessonId,
      {
        watchedSeconds: 5,
        enforceDeltaCheck: true,
      },
    );

    expect(progress.watchedSeconds).toBe(5);
  });
});
