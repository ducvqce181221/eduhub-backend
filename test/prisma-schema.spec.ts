import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createPrismaClient } from "../src/lib/prisma";
import { PrismaClient } from "../src/generated/prisma/client";

describe("Prisma Schema & Relational Integrity (Phase 2)", () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = createPrismaClient();
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("should have all 16 models accessible via Prisma Client", async () => {
    const counts = await Promise.all([
      prisma.user.count(),
      prisma.category.count(),
      prisma.course.count(),
      prisma.chapter.count(),
      prisma.lesson.count(),
      prisma.video.count(),
      prisma.resource.count(),
      prisma.mediaAsset.count(),
      prisma.quiz.count(),
      prisma.question.count(),
      prisma.answer.count(),
      prisma.enrollment.count(),
      prisma.lessonProgress.count(),
      prisma.quizAttempt.count(),
      prisma.quizAttemptAnswer.count(),
      prisma.notification.count(),
    ]);

    expect(counts.length).toBe(16);
    counts.forEach((count) => {
      expect(typeof count).toBe("number");
    });
  });

  it("should enforce onDelete: Restrict on Category when courses exist", async () => {
    // 1. Create a test category
    const cat = await prisma.category.create({
      data: {
        name: "Test Restrict Category",
        slug: "test-restrict-cat-" + Date.now(),
      },
    });

    // 2. Create a test user (teacher)
    const teacher = await prisma.user.create({
      data: {
        email: `teacher-restrict-${Date.now()}@eduhub.dev`,
        passwordHash: "hash123",
        fullName: "Test Teacher",
        role: "TEACHER",
      },
    });

    // 3. Create a course referencing the category
    const course = await prisma.course.create({
      data: {
        title: "Test Course for Restrict",
        slug: `test-course-restrict-${Date.now()}`,
        categoryId: cat.id,
        teacherId: teacher.id,
      },
    });

    // 4. Attempting to delete category should fail due to onDelete: Restrict
    await expect(
      prisma.category.delete({
        where: { id: cat.id },
      }),
    ).rejects.toThrow();

    // Cleanup
    await prisma.course.delete({ where: { id: course.id } });
    await prisma.category.delete({ where: { id: cat.id } });
    await prisma.user.delete({ where: { id: teacher.id } });
  });

  it("should enforce onDelete: Cascade on Course -> Chapter -> Lesson -> Video/Quiz", async () => {
    // 1. Create teacher and category
    const cat = await prisma.category.create({
      data: {
        name: "Cascade Test Category " + Date.now(),
        slug: "cascade-cat-" + Date.now(),
      },
    });

    const teacher = await prisma.user.create({
      data: {
        email: `teacher-cascade-${Date.now()}@eduhub.dev`,
        passwordHash: "hash123",
        fullName: "Cascade Teacher",
        role: "TEACHER",
      },
    });

    // 2. Create full tree
    const course = await prisma.course.create({
      data: {
        title: "Cascade Hierarchy Course",
        slug: `cascade-course-${Date.now()}`,
        categoryId: cat.id,
        teacherId: teacher.id,
        chapters: {
          create: [
            {
              title: "Cascade Chapter 1",
              order: 1,
              lessons: {
                create: [
                  {
                    title: "Cascade Lesson 1",
                    order: 1,
                    video: {
                      create: {
                        title: "Cascade Video",
                        videoUrl: "https://example.com/v.mp4",
                        durationSeconds: 120,
                      },
                    },
                    resources: {
                      create: [
                        {
                          name: "Cascade Resource",
                          fileUrl: "https://example.com/r.pdf",
                          fileType: "pdf",
                          fileSize: 1024,
                        },
                      ],
                    },
                    quiz: {
                      create: {
                        title: "Cascade Quiz",
                        passScore: 80,
                        questions: {
                          create: [
                            {
                              content: "Cascade Q1?",
                              order: 1,
                              points: 1,
                              answers: {
                                create: [
                                  { content: "A1", isCorrect: true },
                                  { content: "A2", isCorrect: false },
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
                video: true,
                resources: true,
                quiz: {
                  include: {
                    questions: {
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

    const chapterId = course.chapters[0].id;
    const lessonId = course.chapters[0].lessons[0].id;
    const videoId = course.chapters[0].lessons[0].video?.id;
    const resourceId = course.chapters[0].lessons[0].resources[0].id;
    const quizId = course.chapters[0].lessons[0].quiz?.id;
    const questionId = course.chapters[0].lessons[0].quiz?.questions[0].id;
    const answerId = course.chapters[0].lessons[0].quiz?.questions[0].answers[0].id;

    // 3. Delete Course
    await prisma.course.delete({ where: { id: course.id } });

    // 4. Verify all child entities are cascaded away
    const [chapCheck, lesCheck, vidCheck, resCheck, qzCheck, qstCheck, ansCheck] =
      await Promise.all([
        prisma.chapter.findUnique({ where: { id: chapterId } }),
        prisma.lesson.findUnique({ where: { id: lessonId } }),
        prisma.video.findUnique({ where: { id: videoId } }),
        prisma.resource.findUnique({ where: { id: resourceId } }),
        prisma.quiz.findUnique({ where: { id: quizId } }),
        prisma.question.findUnique({ where: { id: questionId } }),
        prisma.answer.findUnique({ where: { id: answerId } }),
      ]);

    expect(chapCheck).toBeNull();
    expect(lesCheck).toBeNull();
    expect(vidCheck).toBeNull();
    expect(resCheck).toBeNull();
    expect(qzCheck).toBeNull();
    expect(qstCheck).toBeNull();
    expect(ansCheck).toBeNull();

    // Cleanup
    await prisma.category.delete({ where: { id: cat.id } });
    await prisma.user.delete({ where: { id: teacher.id } });
  });

  it("should enforce unique constraint on @@unique([courseId, order]) for Chapter", async () => {
    const cat = await prisma.category.create({
      data: {
        name: "Unique Chapter Cat " + Date.now(),
        slug: "unique-chap-cat-" + Date.now(),
      },
    });

    const teacher = await prisma.user.create({
      data: {
        email: `teacher-unique-${Date.now()}@eduhub.dev`,
        passwordHash: "hash123",
        fullName: "Unique Teacher",
        role: "TEACHER",
      },
    });

    const course = await prisma.course.create({
      data: {
        title: "Unique Chapter Course",
        slug: `unique-chap-course-${Date.now()}`,
        categoryId: cat.id,
        teacherId: teacher.id,
      },
    });

    // 1. Create first chapter with order 1
    await prisma.chapter.create({
      data: {
        courseId: course.id,
        title: "Chapter 1",
        order: 1,
      },
    });

    // 2. Attempting to create second chapter with same order 1 should fail
    await expect(
      prisma.chapter.create({
        data: {
          courseId: course.id,
          title: "Duplicate Chapter 1",
          order: 1,
        },
      }),
    ).rejects.toThrow();

    // Cleanup
    await prisma.course.delete({ where: { id: course.id } });
    await prisma.category.delete({ where: { id: cat.id } });
    await prisma.user.delete({ where: { id: teacher.id } });
  });

  it("should enforce 1:0..1 unique constraint on Video.lessonId and Quiz.lessonId", async () => {
    const cat = await prisma.category.create({
      data: {
        name: "Unique 1:1 Cat " + Date.now(),
        slug: "unique-1to1-cat-" + Date.now(),
      },
    });

    const teacher = await prisma.user.create({
      data: {
        email: `teacher-1to1-${Date.now()}@eduhub.dev`,
        passwordHash: "hash123",
        fullName: "1to1 Teacher",
        role: "TEACHER",
      },
    });

    const course = await prisma.course.create({
      data: {
        title: "1to1 Unique Course",
        slug: `unique-1to1-course-${Date.now()}`,
        categoryId: cat.id,
        teacherId: teacher.id,
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
                        title: "Video 1",
                        videoUrl: "https://example.com/1.mp4",
                        durationSeconds: 100,
                      },
                    },
                    quiz: {
                      create: {
                        title: "Quiz 1",
                        passScore: 80,
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

    const lessonId = course.chapters[0].lessons[0].id;

    // Attempting to attach second video to same lesson should fail
    await expect(
      prisma.video.create({
        data: {
          lessonId,
          title: "Duplicate Video",
          videoUrl: "https://example.com/2.mp4",
          durationSeconds: 200,
        },
      }),
    ).rejects.toThrow();

    // Attempting to attach second quiz to same lesson should fail
    await expect(
      prisma.quiz.create({
        data: {
          lessonId,
          title: "Duplicate Quiz",
          passScore: 90,
        },
      }),
    ).rejects.toThrow();

    // Cleanup
    await prisma.course.delete({ where: { id: course.id } });
    await prisma.category.delete({ where: { id: cat.id } });
    await prisma.user.delete({ where: { id: teacher.id } });
  });

  it("should support MediaAsset library items, link to Resource/Video, and survive Lesson deletion", async () => {
    const teacher = await prisma.user.create({
      data: {
        email: `teacher-asset-${Date.now()}@eduhub.dev`,
        passwordHash: "hash123",
        fullName: "Asset Teacher",
        role: "TEACHER",
      },
    });

    const cat = await prisma.category.create({
      data: {
        name: "Asset Cat " + Date.now(),
        slug: "asset-cat-" + Date.now(),
      },
    });

    // 1. Create MediaAsset in teacher library
    const asset = await prisma.mediaAsset.create({
      data: {
        uploaderId: teacher.id,
        name: "Shared Slides.pdf",
        fileUrl: "https://media.local/resources/shared-slides.pdf",
        fileType: "application/pdf",
        fileSize: 2048576,
        contentHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        source: "R2_UPLOAD",
        mediaType: "DOCUMENT",
      },
    });

    expect(asset.id).toBeDefined();
    expect(asset.uploaderId).toBe(teacher.id);

    // 2. Create Course -> Chapter -> Lesson and attach resource linking to asset
    const course = await prisma.course.create({
      data: {
        title: "Asset Test Course",
        slug: `asset-course-${Date.now()}`,
        categoryId: cat.id,
        teacherId: teacher.id,
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
                    resources: {
                      create: [
                        {
                          name: asset.name,
                          fileUrl: asset.fileUrl,
                          fileType: asset.fileType,
                          fileSize: asset.fileSize,
                          assetId: asset.id,
                          isExternal: false,
                        },
                      ],
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
                resources: true,
              },
            },
          },
        },
      },
    });

    const resource = course.chapters[0].lessons[0].resources[0];
    expect(resource.assetId).toBe(asset.id);
    expect(resource.isExternal).toBe(false);

    // 3. Delete the course/lesson: Resource should cascade-delete, but MediaAsset must survive!
    await prisma.course.delete({ where: { id: course.id } });

    const deletedResource = await prisma.resource.findUnique({ where: { id: resource.id } });
    expect(deletedResource).toBeNull();

    const survivingAsset = await prisma.mediaAsset.findUnique({ where: { id: asset.id } });
    expect(survivingAsset).not.toBeNull();
    expect(survivingAsset?.id).toBe(asset.id);

    // Cleanup
    await prisma.mediaAsset.delete({ where: { id: asset.id } });
    await prisma.category.delete({ where: { id: cat.id } });
    await prisma.user.delete({ where: { id: teacher.id } });
  });
});
