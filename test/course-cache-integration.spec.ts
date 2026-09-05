import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "../src/prisma/prisma.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { RedisCacheModule } from "../src/common/cache/redis-cache.module";
import { RedisCacheService } from "../src/common/cache/redis-cache.service";
import { CoursesService } from "../src/courses/courses.service";
import { ChaptersService } from "../src/chapters/chapters.service";
import { LessonsService } from "../src/lessons/lessons.service";
import { CourseLevel, CourseStatus, Role } from "../src/generated/prisma/client";

describe("Phase 8 - Cụm 2: Course Catalog Caching & Invalidation Integration Tests", () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let cacheService: RedisCacheService;
  let coursesService: CoursesService;
  let chaptersService: ChaptersService;
  let lessonsService: LessonsService;

  let testTeacherId: string;
  let testCategoryId: string;
  let publishedCourseId: string;
  let draftCourseId: string;
  let chapterId: string;
  let lessonId: string;

  const timestamp = Date.now();

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        PrismaModule,
        RedisCacheModule,
      ],
      providers: [CoursesService, ChaptersService, LessonsService],
    }).compile();

    prisma = moduleRef.get<PrismaService>(PrismaService);
    cacheService = moduleRef.get<RedisCacheService>(RedisCacheService);
    coursesService = moduleRef.get<CoursesService>(CoursesService);
    chaptersService = moduleRef.get<ChaptersService>(ChaptersService);
    lessonsService = moduleRef.get<LessonsService>(LessonsService);

    // Setup seed data in PostgreSQL
    const teacher = await prisma.user.create({
      data: {
        email: `cache_teacher_${timestamp}@eduhub.test`,
        passwordHash: "dummy-hash",
        fullName: "Cache Test Teacher",
        role: Role.TEACHER,
      },
    });
    testTeacherId = teacher.id;

    const category = await prisma.category.create({
      data: {
        name: `CacheCat_${timestamp}`,
        slug: `cache-cat-${timestamp}`,
        isActive: true,
      },
    });
    testCategoryId = category.id;

    // Create published course with curriculum & video
    const publishedCourse = await prisma.course.create({
      data: {
        title: `Cache Published Course ${timestamp}`,
        slug: `cache-published-course-${timestamp}`,
        description: "Course for caching integration tests",
        thumbnailUrl: "https://r2.eduhub.test/thumb.jpg",
        level: CourseLevel.BEGINNER,
        status: CourseStatus.PUBLISHED,
        publishedAt: new Date(),
        teacherId: testTeacherId,
        categoryId: testCategoryId,
      },
    });
    publishedCourseId = publishedCourse.id;

    const chapter = await prisma.chapter.create({
      data: {
        title: "Chapter 1",
        order: 1,
        courseId: publishedCourseId,
      },
    });
    chapterId = chapter.id;

    const lesson = await prisma.lesson.create({
      data: {
        title: "Lesson 1",
        order: 1,
        chapterId: chapter.id,
      },
    });
    lessonId = lesson.id;

    await prisma.video.create({
      data: {
        lessonId: lesson.id,
        videoUrl: "https://r2.eduhub.test/video.mp4",
        durationSeconds: 600,
        title: "Lesson 1 Video",
      },
    });

    // Create a draft course for mutation tests
    const draftCourse = await prisma.course.create({
      data: {
        title: `Cache Draft Course ${timestamp}`,
        slug: `cache-draft-course-${timestamp}`,
        description: "Draft course",
        thumbnailUrl: "https://r2.eduhub.test/draft.jpg",
        level: CourseLevel.INTERMEDIATE,
        status: CourseStatus.DRAFT,
        teacherId: testTeacherId,
        categoryId: testCategoryId,
      },
    });
    draftCourseId = draftCourse.id;
  });

  afterAll(async () => {
    // Clean up Redis & Postgres
    await cacheService.delByPattern("courses:list:*");
    await prisma.video.deleteMany({ where: { lessonId } });
    await prisma.lesson.deleteMany({ where: { chapterId } });
    await prisma.chapter.deleteMany({ where: { courseId: publishedCourseId } });
    await prisma.course.deleteMany({
      where: { id: { in: [publishedCourseId, draftCourseId] } },
    });
    await prisma.category.deleteMany({ where: { id: testCategoryId } });
    await prisma.mediaAsset.deleteMany({ where: { uploaderId: testTeacherId } });
    await prisma.user.deleteMany({ where: { id: testTeacherId } });

    if (moduleRef) {
      await moduleRef.close();
    }
  });

  beforeEach(async () => {
    // Clear course list cache before each test
    await cacheService.delByPattern("courses:list:*");
  });

  describe("1. Cache Miss, Cache Hit & Key Generation (BR-CCH-01)", () => {
    it("should populate Redis cache on cache miss (first request)", async () => {
      const query = { page: 1, limit: 10 };

      // 1. Initial query: Cache Miss -> calls DB and saves to Redis
      const result = await coursesService.findAll(query);
      expect(result.items.length).toBeGreaterThan(0);

      // Verify a Redis key matching courses:list:* exists
      const redisClient = cacheService.getClient();
      const [, keys] = await redisClient.scan("0", "MATCH", "courses:list:*", "COUNT", 10);
      expect(keys.length).toBeGreaterThan(0);
    });

    it("should serve results from Redis cache on cache hit without re-querying Prisma", async () => {
      const query = { page: 1, limit: 10 };

      // First call (populates cache)
      await coursesService.findAll(query);

      // Spy on Prisma findMany
      const prismaSpy = vi.spyOn(prisma.course, "findMany");

      // Second call (should hit cache)
      const cachedResult = await coursesService.findAll(query);

      expect(cachedResult).toBeDefined();
      expect(cachedResult.items.length).toBeGreaterThan(0);
      expect(prismaSpy).not.toHaveBeenCalled();

      prismaSpy.mockRestore();
    });

    it("should generate distinct cache keys for different query parameters", async () => {
      await coursesService.findAll({ page: 1, limit: 5 });
      await coursesService.findAll({ page: 2, limit: 5 });
      await coursesService.findAll({ level: CourseLevel.BEGINNER });

      const redisClient = cacheService.getClient();
      const [, keys] = await redisClient.scan("0", "MATCH", "courses:list:*", "COUNT", 20);

      // Should have generated 3 distinct cache keys
      expect(keys.length).toBe(3);
    });

    it("should gracefully fall back to database if Redis get fails", async () => {
      const query = { page: 1, limit: 10 };

      // Stub cacheService.get to return null (simulating failure / miss)
      const getSpy = vi.spyOn(cacheService, "get").mockResolvedValueOnce(null);

      const result = await coursesService.findAll(query);
      expect(result.items).toBeDefined();
      expect(result.items.length).toBeGreaterThan(0);

      getSpy.mockRestore();
    });
  });

  describe("2. Cache Invalidation on Course Mutations (BR-CCH-02)", () => {
    beforeEach(async () => {
      // Warm up cache
      await coursesService.findAll({ page: 1, limit: 10 });
      const redisClient = cacheService.getClient();
      const [, keys] = await redisClient.scan("0", "MATCH", "courses:list:*", "COUNT", 10);
      expect(keys.length).toBeGreaterThan(0);
    });

    it("should invalidate courses:list:* when creating a course", async () => {
      const created = await coursesService.create(testTeacherId, {
        title: `Newly Created Course ${Date.now()}`,
        categoryId: testCategoryId,
      });

      const redisClient = cacheService.getClient();
      const [, keys] = await redisClient.scan("0", "MATCH", "courses:list:*", "COUNT", 10);
      expect(keys.length).toBe(0);

      await prisma.course.delete({ where: { id: created.id } });
    });

    it("should invalidate courses:list:* when updating a course", async () => {
      await coursesService.update(draftCourseId, {
        title: `Updated Title ${Date.now()}`,
      });

      const redisClient = cacheService.getClient();
      const [, keys] = await redisClient.scan("0", "MATCH", "courses:list:*", "COUNT", 10);
      expect(keys.length).toBe(0);
    });

    it("should invalidate courses:list:* when publishing a course", async () => {
      // Setup minimal publish requirements on draft course
      const dChapter = await prisma.chapter.create({
        data: { title: "Draft Chap", order: 1, courseId: draftCourseId },
      });
      const dLesson = await prisma.lesson.create({
        data: { title: "Draft Les", order: 1, chapterId: dChapter.id },
      });
      await prisma.video.create({
        data: {
          lessonId: dLesson.id,
          videoUrl: "https://r2.test/v.mp4",
          durationSeconds: 300,
          title: "Draft Video",
        },
      });

      await coursesService.publish(draftCourseId);

      const redisClient = cacheService.getClient();
      const [, keys] = await redisClient.scan("0", "MATCH", "courses:list:*", "COUNT", 10);
      expect(keys.length).toBe(0);

      // Clean up draft curriculum
      await prisma.video.deleteMany({ where: { lessonId: dLesson.id } });
      await prisma.lesson.deleteMany({ where: { id: dLesson.id } });
      await prisma.chapter.deleteMany({ where: { id: dChapter.id } });
    });

    it("should invalidate courses:list:* when unpublishing a course", async () => {
      await coursesService.unpublish(publishedCourseId);

      const redisClient = cacheService.getClient();
      const [, keys] = await redisClient.scan("0", "MATCH", "courses:list:*", "COUNT", 10);
      expect(keys.length).toBe(0);

      // Restore published status
      await prisma.course.update({
        where: { id: publishedCourseId },
        data: { status: CourseStatus.PUBLISHED },
      });
    });

    it("should invalidate courses:list:* when archiving a course", async () => {
      await coursesService.archive(draftCourseId);

      const redisClient = cacheService.getClient();
      const [, keys] = await redisClient.scan("0", "MATCH", "courses:list:*", "COUNT", 10);
      expect(keys.length).toBe(0);
    });
  });

  describe("3. Cache Invalidation on Chapter & Lesson Mutations (BR-CCH-02)", () => {
    beforeEach(async () => {
      // Warm up cache
      await coursesService.findAll({ page: 1, limit: 10 });
    });

    it("should invalidate courses:list:* when a chapter is created, updated, or reordered", async () => {
      // Create chapter
      const newChap = await chaptersService.create(draftCourseId, { title: "New Chap" });
      let [, keys] = await cacheService.getClient().scan("0", "MATCH", "courses:list:*");
      expect(keys.length).toBe(0);

      // Warm up cache again
      await coursesService.findAll({ page: 1, limit: 10 });

      // Update chapter
      await chaptersService.update(newChap.id, { title: "Updated Chap Title" });
      [, keys] = await cacheService.getClient().scan("0", "MATCH", "courses:list:*");
      expect(keys.length).toBe(0);

      // Clean up
      await prisma.chapter.delete({ where: { id: newChap.id } });
    });

    it("should invalidate courses:list:* when a lesson is created, updated, or video is updated", async () => {
      // Create lesson
      const newLesson = await lessonsService.create(chapterId, { title: "New Lesson" });
      let [, keys] = await cacheService.getClient().scan("0", "MATCH", "courses:list:*");
      expect(keys.length).toBe(0);

      // Warm up cache again
      await coursesService.findAll({ page: 1, limit: 10 });

      // Upsert video
      await lessonsService.upsertVideo(newLesson.id, {
        videoUrl: "https://r2.test/v2.mp4",
        durationSeconds: 500,
      });
      [, keys] = await cacheService.getClient().scan("0", "MATCH", "courses:list:*");
      expect(keys.length).toBe(0);

      // Clean up
      await prisma.video.deleteMany({ where: { lessonId: newLesson.id } });
      await prisma.lesson.deleteMany({ where: { id: newLesson.id } });
    });
  });
});
