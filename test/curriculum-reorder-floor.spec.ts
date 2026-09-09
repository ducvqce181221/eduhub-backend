import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { BadRequestException } from "@nestjs/common";
import { ChaptersService } from "../src/chapters/chapters.service";
import { LessonsService } from "../src/lessons/lessons.service";
import { ResourcesService } from "../src/lessons/resources.service";
import { createPrismaClient } from "../src/lib/prisma";
import type { PrismaClient } from "../src/generated/prisma/client";
import { CourseLevel, CourseStatus, Role } from "../src/generated/prisma/client";

describe("Phase 5 - Part 5: Curriculum Reorder, Floor Protection & Media", () => {
  let prisma: PrismaClient;
  let chaptersService: ChaptersService;
  let lessonsService: LessonsService;
  let resourcesService: ResourcesService;

  let activeCategoryId: string;
  let teacherId: string;
  let studentId: string;
  let draftCourseId: string;
  let publishedCourseId: string;

  const timestamp = Date.now();

  beforeAll(async () => {
    prisma = createPrismaClient();
    chaptersService = new ChaptersService(prisma as any);
    lessonsService = new LessonsService(prisma as any);
    resourcesService = new ResourcesService(prisma as any);

    const category = await prisma.category.create({
      data: {
        name: `CurriculumCat_${timestamp}`,
        slug: `curriculum-cat-${timestamp}`,
        isActive: true,
      },
    });
    activeCategoryId = category.id;

    const teacher = await prisma.user.create({
      data: {
        email: `teacher_curr_${timestamp}@eduhub.test`,
        passwordHash: "hash",
        fullName: "Curriculum Teacher",
        role: Role.TEACHER,
      },
    });
    teacherId = teacher.id;

    const student = await prisma.user.create({
      data: {
        email: `student_curr_${timestamp}@eduhub.test`,
        passwordHash: "hash",
        fullName: "Curriculum Student",
        role: Role.STUDENT,
      },
    });
    studentId = student.id;

    // Create Draft Course
    const draftCourse = await prisma.course.create({
      data: {
        title: "Draft Curriculum Course",
        slug: `draft-curr-${timestamp}`,
        categoryId: activeCategoryId,
        teacherId,
        status: CourseStatus.DRAFT,
      },
    });
    draftCourseId = draftCourse.id;

    // Create Published Course
    const pubCourse = await prisma.course.create({
      data: {
        title: "Published Floor Test Course",
        slug: `pub-floor-${timestamp}`,
        categoryId: activeCategoryId,
        teacherId,
        status: CourseStatus.PUBLISHED,
        publishedAt: new Date(),
        chapters: {
          create: [
            {
              title: "Only Chapter in Published Course",
              order: 1,
              lessons: {
                create: [
                  {
                    title: "Only Lesson in Chapter",
                    order: 1,
                    video: {
                      create: {
                        title: "Video 1",
                        videoUrl: "https://media.local/v1.mp4",
                        durationSeconds: 300,
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
    publishedCourseId = pubCourse.id;
  });

  afterAll(async () => {
    await prisma.resource.deleteMany({
      where: { lesson: { chapter: { course: { teacherId } } } },
    });
    await prisma.video.deleteMany({
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
    await prisma.mediaAsset.deleteMany({
      where: { uploaderId: { in: [teacherId, studentId] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [teacherId, studentId] } },
    });
  });

  it("should auto-increment chapter order as max + 1 [BR-CRS-05]", async () => {
    const ch1 = await chaptersService.create(draftCourseId, {
      title: "Chapter 1",
    });
    const ch2 = await chaptersService.create(draftCourseId, {
      title: "Chapter 2",
    });
    const ch3 = await chaptersService.create(draftCourseId, {
      title: "Chapter 3",
    });

    expect(ch1.order).toBe(1);
    expect(ch2.order).toBe(2);
    expect(ch3.order).toBe(3);
  });

  it("should auto-increment lesson order as max + 1 [BR-CRS-05]", async () => {
    const chapter = await prisma.chapter.findFirst({
      where: { courseId: draftCourseId, title: "Chapter 1" },
    });

    const l1 = await lessonsService.create(chapter!.id, {
      title: "Lesson 1",
    });
    const l2 = await lessonsService.create(chapter!.id, {
      title: "Lesson 2",
    });
    const l3 = await lessonsService.create(chapter!.id, {
      title: "Lesson 3",
    });

    expect(l1.order).toBe(1);
    expect(l2.order).toBe(2);
    expect(l3.order).toBe(3);
  });

  it("should reorder chapters atomically in transaction without collision [BR-CRS-05]", async () => {
    const chapters = await prisma.chapter.findMany({
      where: { courseId: draftCourseId },
      orderBy: { order: "asc" },
    });

    expect(chapters.length).toBeGreaterThanOrEqual(3);

    // Swap order: ch1 -> 3, ch2 -> 1, ch3 -> 2
    const reorderPayload = [
      { id: chapters[0].id, order: 3 },
      { id: chapters[1].id, order: 1 },
      { id: chapters[2].id, order: 2 },
    ];

    const result = await chaptersService.reorder(draftCourseId, reorderPayload);
    expect(result.message).toBe("Chapters reordered successfully");

    const reorderedChapters = await prisma.chapter.findMany({
      where: { courseId: draftCourseId },
      orderBy: { order: "asc" },
    });

    expect(reorderedChapters[0].id).toBe(chapters[1].id);
    expect(reorderedChapters[1].id).toBe(chapters[2].id);
    expect(reorderedChapters[2].id).toBe(chapters[0].id);
  });

  it("should reorder lessons atomically in transaction without collision [BR-CRS-05]", async () => {
    const chapter = await prisma.chapter.findFirst({
      where: { courseId: draftCourseId, title: "Chapter 1" },
    });

    const lessons = await prisma.lesson.findMany({
      where: { chapterId: chapter!.id },
      orderBy: { order: "asc" },
    });

    expect(lessons.length).toBeGreaterThanOrEqual(3);

    const reorderPayload = [
      { id: lessons[0].id, order: 3 },
      { id: lessons[1].id, order: 2 },
      { id: lessons[2].id, order: 1 },
    ];

    const result = await lessonsService.reorder(chapter!.id, reorderPayload);
    expect(result.message).toBe("Lessons reordered successfully");

    const reorderedLessons = await prisma.lesson.findMany({
      where: { chapterId: chapter!.id },
      orderBy: { order: "asc" },
    });

    expect(reorderedLessons[0].id).toBe(lessons[2].id);
    expect(reorderedLessons[1].id).toBe(lessons[1].id);
    expect(reorderedLessons[2].id).toBe(lessons[0].id);
  });

  it("should block deleting the last chapter of a published course [BR-CRS-06]", async () => {
    const pubChapter = await prisma.chapter.findFirst({
      where: { courseId: publishedCourseId },
    });

    await expect(chaptersService.remove(pubChapter!.id)).rejects.toThrow(
      BadRequestException,
    );
  });

  it("should block deleting the last lesson in a chapter of a published course [BR-CRS-06]", async () => {
    const pubLesson = await prisma.lesson.findFirst({
      where: { chapter: { courseId: publishedCourseId } },
    });

    await expect(lessonsService.remove(pubLesson!.id)).rejects.toThrow(
      BadRequestException,
    );
  });

  it("should allow deleting a chapter/lesson in a draft course without floor restriction [BR-CRS-06]", async () => {
    const draftChapter = await prisma.chapter.findFirst({
      where: { courseId: draftCourseId },
    });

    const result = await chaptersService.remove(draftChapter!.id);
    expect(result.message).toBe("Chapter deleted successfully");
  });

  it("should mask isCorrect in quiz answers when student views lesson [BR-QZ-06]", async () => {
    // Create a lesson with quiz
    const chapter = await prisma.chapter.findFirst({
      where: { courseId: publishedCourseId },
    });

    const lessonWithQuiz = await prisma.lesson.create({
      data: {
        title: "Quiz Masking Test Lesson",
        order: 99,
        chapterId: chapter!.id,
        quiz: {
          create: {
            title: "Lesson Quiz",
            passScore: 80,
            questions: {
              create: [
                {
                  content: "Question 1",
                  answers: {
                    create: [
                      { content: "Choice A", isCorrect: true },
                      { content: "Choice B", isCorrect: false },
                    ],
                  },
                },
              ],
            },
          },
        },
      },
    });

    // Student access: isCorrect must be undefined/masked
    const studentView = await lessonsService.findOne(lessonWithQuiz.id, {
      id: studentId,
      role: Role.STUDENT,
    });
    expect(studentView.quiz).toBeDefined();
    const answers = studentView.quiz!.questions[0].answers as any[];
    expect(answers[0].isCorrect).toBeUndefined();
    expect(answers[1].isCorrect).toBeUndefined();

    // Teacher access: isCorrect must be visible
    const teacherView = await lessonsService.findOne(lessonWithQuiz.id, {
      id: teacherId,
      role: Role.TEACHER,
    });
    const teacherAnswers = teacherView.quiz!.questions[0].answers as any[];
    expect(teacherAnswers[0].isCorrect).toBe(true);
  });

  it("should upsert video metadata with duration validation [BR-LES-01]", async () => {
    const lesson = await prisma.lesson.findFirst({
      where: { chapter: { courseId: publishedCourseId } },
    });

    // Reject duration <= 0
    await expect(
      lessonsService.upsertVideo(lesson!.id, {
        videoUrl: "https://media.local/test.mp4",
        durationSeconds: 0,
      }),
    ).rejects.toThrow(BadRequestException);

    // Upsert valid video
    const video = await lessonsService.upsertVideo(lesson!.id, {
      videoUrl: "https://media.local/new-video.mp4",
      durationSeconds: 450,
      title: "Updated Video Lecture",
    });

    expect(video).toBeDefined();
    expect(video.durationSeconds).toBe(450);
    expect(video.videoUrl).toBe("https://media.local/new-video.mp4");
  });

  it("should manage lesson downloadable resources with valid fileSize [BR-LES-02]", async () => {
    const lesson = await prisma.lesson.findFirst({
      where: { chapter: { courseId: publishedCourseId } },
    });

    // Create resource
    const resource = await resourcesService.create(lesson!.id, {
      name: "Source Code.zip",
      fileUrl: "https://media.local/resources/src.zip",
      fileType: "application/zip",
      fileSize: 1048576, // 1MB
    });

    expect(resource).toBeDefined();
    expect(resource.id).toBeDefined();
    expect(resource.fileSize).toBe(1048576);

    // Update resource
    const updated = await resourcesService.update(resource.id, {
      name: "Source Code v2.zip",
    });
    expect(updated.name).toBe("Source Code v2.zip");

    // Delete resource
    const delResult = await resourcesService.remove(resource.id);
    expect(delResult.message).toBe("Resource deleted successfully");
  });
});
