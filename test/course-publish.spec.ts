import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { UnprocessableEntityException } from "@nestjs/common";
import { CoursesService } from "../src/courses/courses.service";
import { validateCoursePublish } from "../src/courses/course-publish.validator";
import { createPrismaClient } from "../src/lib/prisma";
import type { PrismaClient } from "../src/generated/prisma/client";
import { CourseLevel, CourseStatus, Role } from "../src/generated/prisma/client";

describe("Phase 5 - Part 4: 5-Point Publish-Ready Checklist Validator & Publish Workflow", () => {
  let prisma: PrismaClient;
  let coursesService: CoursesService;

  let activeCategoryId: string;
  let teacherId: string;
  const timestamp = Date.now();

  beforeAll(async () => {
    prisma = createPrismaClient();
    coursesService = new CoursesService(prisma as any);

    const category = await prisma.category.create({
      data: {
        name: `PublishCat_${timestamp}`,
        slug: `publish-cat-${timestamp}`,
        isActive: true,
      },
    });
    activeCategoryId = category.id;

    const teacher = await prisma.user.create({
      data: {
        email: `teacher_pub_${timestamp}@eduhub.test`,
        passwordHash: "hash",
        fullName: "Publish Teacher",
        role: Role.TEACHER,
      },
    });
    teacherId = teacher.id;
  });

  afterAll(async () => {
    // Delete courses, chapters, lessons, videos
    await prisma.video.deleteMany({
      where: { lesson: { chapter: { course: { teacherId } } } },
    });
    await prisma.resource.deleteMany({
      where: { lesson: { chapter: { course: { teacherId } } } },
    });
    await prisma.question.deleteMany({
      where: { quiz: { lesson: { chapter: { course: { teacherId } } } } },
    });
    await prisma.quiz.deleteMany({
      where: { lesson: { chapter: { course: { teacherId } } } },
    });
    await prisma.lesson.deleteMany({
      where: { chapter: { course: { teacherId } } },
    });
    await prisma.chapter.deleteMany({
      where: { course: { teacherId } },
    });
    await prisma.course.deleteMany({
      where: { teacherId },
    });
    await prisma.category.deleteMany({
      where: { id: activeCategoryId },
    });
    await prisma.user.deleteMany({
      where: { id: teacherId },
    });
  });

  describe("Unit: validateCoursePublish (5-Point Checklist Rules)", () => {
    it("should fail when metadata is missing or incomplete [BR-CRS-02 - Criterion 1]", () => {
      const result = validateCoursePublish({
        title: "",
        description: "",
        thumbnailUrl: "",
        level: CourseLevel.BEGINNER,
        categoryId: activeCategoryId,
        category: { isActive: true },
        chapters: [],
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "Course title is required and cannot be empty.",
      );
      expect(result.errors).toContain(
        "Course description is required and cannot be empty.",
      );
      expect(result.errors).toContain(
        "Course thumbnailUrl is required and cannot be empty.",
      );
    });

    it("should fail when course has 0 chapters [BR-CRS-02 - Criterion 2]", () => {
      const result = validateCoursePublish({
        title: "Full Course",
        description: "Full description",
        thumbnailUrl: "https://media.local/thumb.jpg",
        level: CourseLevel.BEGINNER,
        categoryId: activeCategoryId,
        category: { isActive: true },
        chapters: [],
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Course must contain at least 1 chapter.");
    });

    it("should fail when a chapter contains 0 lessons [BR-CRS-02 - Criterion 3]", () => {
      const result = validateCoursePublish({
        title: "Full Course",
        description: "Full description",
        thumbnailUrl: "https://media.local/thumb.jpg",
        level: CourseLevel.BEGINNER,
        categoryId: activeCategoryId,
        category: { isActive: true },
        chapters: [
          {
            id: "ch-1",
            title: "Chapter 1",
            lessons: [],
          },
        ],
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Chapter "Chapter 1" must contain at least 1 lesson.',
      );
    });

    it("should fail when a lesson is missing video or has duration <= 0 [BR-CRS-02 - Criterion 4]", () => {
      const result = validateCoursePublish({
        title: "Full Course",
        description: "Full description",
        thumbnailUrl: "https://media.local/thumb.jpg",
        level: CourseLevel.BEGINNER,
        categoryId: activeCategoryId,
        category: { isActive: true },
        chapters: [
          {
            id: "ch-1",
            title: "Chapter 1",
            lessons: [
              {
                id: "les-1",
                title: "Lesson 1",
                video: null,
              },
            ],
          },
        ],
      });

      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain("must have an attached video with duration > 0");
    });

    it("should fail when an attached quiz has invalid questions or answers [BR-CRS-02 - Criterion 5]", () => {
      const result = validateCoursePublish({
        title: "Full Course",
        description: "Full description",
        thumbnailUrl: "https://media.local/thumb.jpg",
        level: CourseLevel.BEGINNER,
        categoryId: activeCategoryId,
        category: { isActive: true },
        chapters: [
          {
            id: "ch-1",
            title: "Chapter 1",
            lessons: [
              {
                id: "les-1",
                title: "Lesson 1",
                video: {
                  id: "vid-1",
                  videoUrl: "https://media.local/v1.mp4",
                  durationSeconds: 300,
                },
                quiz: {
                  id: "qz-1",
                  questions: [
                    {
                      id: "q-1",
                      content: "What is NestJS?",
                      answers: [
                        { id: "a-1", isCorrect: true },
                        { id: "a-2", isCorrect: true }, // Invalid: 2 correct answers
                      ],
                    },
                  ],
                },
              },
            ],
          },
        ],
      });

      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain(
        "must have exactly 1 correct answer (found 2)",
      );
    });
  });

  describe("Integration: coursesService.publish", () => {
    it("should reject publish request with 422 Unprocessable Entity when incomplete", async () => {
      // Create empty draft course
      const course = await prisma.course.create({
        data: {
          title: "Incomplete Course",
          slug: `incomplete-course-${timestamp}`,
          categoryId: activeCategoryId,
          teacherId,
          status: CourseStatus.DRAFT,
        },
      });

      await expect(coursesService.publish(course.id)).rejects.toThrow(
        UnprocessableEntityException,
      );
    });

    it("should successfully publish course when all 5 criteria are fully satisfied [BR-CRS-02]", async () => {
      // Build fully compliant course structure
      const course = await prisma.course.create({
        data: {
          title: "Complete Valid Course",
          slug: `valid-course-${timestamp}`,
          description: "Comprehensive valid description",
          thumbnailUrl: "https://media.eduhub.local/thumb.jpg",
          level: CourseLevel.BEGINNER,
          categoryId: activeCategoryId,
          teacherId,
          status: CourseStatus.DRAFT,
          chapters: {
            create: [
              {
                title: "Chapter 1: Foundations",
                order: 1,
                lessons: {
                  create: [
                    {
                      title: "Lesson 1: Intro",
                      order: 1,
                      video: {
                        create: {
                          title: "Intro Video",
                          videoUrl: "https://media.eduhub.local/videos/intro.mp4",
                          durationSeconds: 600,
                        },
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
      });

      const published = await coursesService.publish(course.id);
      expect(published.status).toBe(CourseStatus.PUBLISHED);
      expect(published.publishedAt).toBeDefined();
      expect(published.publishedAt).toBeInstanceOf(Date);
    });
  });
});
