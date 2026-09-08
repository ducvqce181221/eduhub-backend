import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../src/prisma/prisma.service";
import { BannersService } from "../src/banners/banners.service";
import { CoursesService } from "../src/courses/courses.service";
import { TurnstileService } from "../src/auth/turnstile.service";
import { ConfigService } from "@nestjs/config";
import { Role, CourseLevel, CourseStatus } from "../src/generated/prisma/client";

describe("Enhancements: Banners, Guest Preview & Turnstile Security", () => {
  let prisma: PrismaService;
  let bannersService: BannersService;
  let coursesService: CoursesService;
  let turnstileService: TurnstileService;

  let testTeacherId: string;
  let testCategoryId: string;
  let testCourseId: string;
  let testChapterId: string;
  let testLessonId: string;
  let createdBannerId: string;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();

    const configService = {
      get: (key: string) => {
        const conf: Record<string, string> = {
          R2_ACCOUNT_ID: "test-r2-account",
          R2_ACCESS_KEY_ID: "test-access-key",
          R2_SECRET_ACCESS_KEY: "test-secret-key",
          R2_BUCKET_NAME: "eduhub-media",
          R2_PUBLIC_DOMAIN: "https://pub-bf7daf8cf49c4543879289550e1f1e19.r2.dev",
        };
        return conf[key];
      },
    } as unknown as ConfigService;

    bannersService = new BannersService(prisma);
    coursesService = new CoursesService(prisma, undefined, undefined);
    turnstileService = new TurnstileService(configService);

    // Setup dummy teacher, category, course, chapter, lesson with video
    const teacher = await prisma.user.upsert({
      where: { email: "banner-test-teacher@eduhub.dev" },
      update: {},
      create: {
        email: "banner-test-teacher@eduhub.dev",
        fullName: "Banner Teacher",
        role: Role.TEACHER,
      },
    });
    testTeacherId = teacher.id;

    const category = await prisma.category.upsert({
      where: { slug: "banner-test-category" },
      update: {},
      create: {
        name: "Banner Test Category",
        slug: "banner-test-category",
      },
    });
    testCategoryId = category.id;

    const course = await prisma.course.create({
      data: {
        title: "Guest Preview Test Course",
        slug: `preview-course-${Date.now()}`,
        description: "Course to test first video preview for guests",
        categoryId: testCategoryId,
        teacherId: testTeacherId,
        level: CourseLevel.BEGINNER,
        status: CourseStatus.PUBLISHED,
        publishedAt: new Date(),
      },
    });
    testCourseId = course.id;

    const chapter = await prisma.chapter.create({
      data: {
        courseId: testCourseId,
        title: "Chapter 1: Getting Started",
        order: 1,
      },
    });
    testChapterId = chapter.id;

    const lesson1 = await prisma.lesson.create({
      data: {
        chapterId: testChapterId,
        title: "Lesson 1: Intro Lecture",
        order: 1,
        video: {
          create: {
            title: "Intro Lecture Video",
            videoUrl: "https://pub-bf7daf8cf49c4543879289550e1f1e19.r2.dev/videos/intro.mp4",
            durationSeconds: 300,
            isExternal: false,
          },
        },
      },
      include: { video: true },
    });
    testLessonId = lesson1.id;

    // Second lesson with video (should stay masked for guests)
    await prisma.lesson.create({
      data: {
        chapterId: testChapterId,
        title: "Lesson 2: Deep Dive (Locked)",
        order: 2,
        video: {
          create: {
            title: "Deep Dive Video",
            videoUrl: "https://pub-bf7daf8cf49c4543879289550e1f1e19.r2.dev/videos/locked.mp4",
            durationSeconds: 600,
            isExternal: false,
          },
        },
      },
    });
  });

  afterAll(async () => {
    if (createdBannerId) {
      await prisma.banner.deleteMany({ where: { id: createdBannerId } });
    }
    if (testCourseId) {
      await prisma.course.deleteMany({ where: { id: testCourseId } });
    }
    if (testCategoryId) {
      await prisma.category.deleteMany({ where: { id: testCategoryId } });
    }
    if (testTeacherId) {
      await prisma.user.deleteMany({ where: { id: testTeacherId } });
    }
    await prisma.$disconnect();
  });

  describe("1. Banners Management", () => {
    it("should create a promotional banner and calculate order automatically", async () => {
      const banner = await bannersService.create({
        title: "Spring Promo 2026",
        imageUrl: "https://res.cloudinary.com/eduhub/banner1.jpg",
        linkUrl: "/courses/guest-preview-test-course",
        isActive: true,
      });

      expect(banner).toBeDefined();
      expect(banner.id).toBeDefined();
      expect(banner.title).toBe("Spring Promo 2026");
      expect(banner.order).toBeGreaterThanOrEqual(0);
      createdBannerId = banner.id;
    });

    it("should retrieve active banners in findActive()", async () => {
      const activeBanners = await bannersService.findActive();
      expect(Array.isArray(activeBanners)).toBe(true);
      const found = activeBanners.find((b) => b.id === createdBannerId);
      expect(found).toBeDefined();
      expect(found?.isActive).toBe(true);
    });

    it("should update banner fields and active status", async () => {
      const updated = await bannersService.update(createdBannerId, {
        title: "Updated Promo 2026",
        isActive: false,
      });

      expect(updated.title).toBe("Updated Promo 2026");
      expect(updated.isActive).toBe(false);

      const activeAfterDeactivate = await bannersService.findActive();
      const found = activeAfterDeactivate.find((b) => b.id === createdBannerId);
      expect(found).toBeUndefined();
    });

    it("should throw NotFoundException when updating non-existent banner", async () => {
      await expect(
        bannersService.update("00000000-0000-0000-0000-000000000000", { title: "X" }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("2. Guest First Video Preview", () => {
    it("should expose preview video for the first lesson while masking subsequent lessons for guests", async () => {
      const course = await coursesService.findOne(testCourseId, undefined);

      expect(course).toBeDefined();
      expect(course.previewLessonId).toBe(testLessonId);

      const lessons = course.chapters[0].lessons;
      expect(lessons).toHaveLength(2);

      // First lesson is preview
      const firstLesson = lessons[0];
      expect(firstLesson.video).toBeDefined();
      expect(firstLesson.video?.isPreview).toBe(true);
      expect((firstLesson.video as any)?.playbackUrl).toBeDefined();
      expect(firstLesson.video?.videoUrl).toBeUndefined();

      // Second lesson must remain locked / masked
      const secondLesson = lessons[1];
      expect(secondLesson.video).toBeDefined();
      expect(secondLesson.video?.isPreview).toBe(false);
      expect(secondLesson.video?.videoUrl).toBeUndefined();
      expect((secondLesson.video as any)?.playbackUrl).toBeUndefined();

    });

    it("should return streamable preview video payload via getPreviewVideo()", async () => {
      const preview = await coursesService.getPreviewVideo(testCourseId);

      expect(preview).toBeDefined();
      expect(preview.courseId).toBe(testCourseId);
      expect(preview.lessonId).toBe(testLessonId);
      expect(preview.isPreview).toBe(true);
      expect(preview.videoUrl).toContain("/videos/intro.mp4");
      expect(preview.durationSeconds).toBe(300);
    });
  });

  describe("3. Cloudflare Turnstile Security", () => {
    it("should bypass verification in test environment when token is omitted", async () => {
      const result = await turnstileService.verifyToken(undefined);
      expect(result).toBe(true);
    });

    it("should accept official dummy testing token in test environment", async () => {
      const result = await turnstileService.verifyToken("1x00000000000000000000AA");
      expect(result).toBe(true);
    });
  });
});
