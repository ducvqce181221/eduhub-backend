import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { CoursesService } from "../src/courses/courses.service";
import { createPrismaClient } from "../src/lib/prisma";
import type { PrismaClient } from "../src/generated/prisma/client";
import { CourseLevel, CourseStatus, Role } from "../src/generated/prisma/client";

describe("Phase 5 - Part 3: Course Management & Lifecycle Transitions", () => {
  let prisma: PrismaClient;
  let coursesService: CoursesService;

  let activeCategoryId: string;
  let inactiveCategoryId: string;
  let teacherAId: string;
  let teacherBId: string;
  let adminId: string;

  const timestamp = Date.now();

  beforeAll(async () => {
    prisma = createPrismaClient();
    coursesService = new CoursesService(prisma as any);

    // Create categories
    const activeCat = await prisma.category.create({
      data: {
        name: `CourseCat_Active_${timestamp}`,
        slug: `course-cat-active-${timestamp}`,
        isActive: true,
      },
    });
    activeCategoryId = activeCat.id;

    const inactiveCat = await prisma.category.create({
      data: {
        name: `CourseCat_Inactive_${timestamp}`,
        slug: `course-cat-inactive-${timestamp}`,
        isActive: false,
      },
    });
    inactiveCategoryId = inactiveCat.id;

    // Create users
    const teacherA = await prisma.user.create({
      data: {
        email: `teacher_a_${timestamp}@eduhub.test`,
        passwordHash: "hash",
        fullName: "Teacher A",
        role: Role.TEACHER,
      },
    });
    teacherAId = teacherA.id;

    const teacherB = await prisma.user.create({
      data: {
        email: `teacher_b_${timestamp}@eduhub.test`,
        passwordHash: "hash",
        fullName: "Teacher B",
        role: Role.TEACHER,
      },
    });
    teacherBId = teacherB.id;

    const admin = await prisma.user.create({
      data: {
        email: `admin_crs_${timestamp}@eduhub.test`,
        passwordHash: "hash",
        fullName: "Admin User",
        role: Role.ADMIN,
      },
    });
    adminId = admin.id;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.course.deleteMany({
      where: {
        OR: [{ teacherId: teacherAId }, { teacherId: teacherBId }],
      },
    });
    await prisma.category.deleteMany({
      where: {
        id: { in: [activeCategoryId, inactiveCategoryId] },
      },
    });
    await prisma.user.deleteMany({
      where: {
        id: { in: [teacherAId, teacherBId, adminId] },
      },
    });
  });

  it("should create a draft course with a unique deterministic slug [BR-CRS-01]", async () => {
    const course = await coursesService.create(teacherAId, {
      title: "Lập trình NestJS chuyên sâu",
      categoryId: activeCategoryId,
      description: "Học toàn diện NestJS",
      level: CourseLevel.INTERMEDIATE,
    });

    expect(course).toBeDefined();
    expect(course.id).toBeDefined();
    expect(course.status).toBe(CourseStatus.DRAFT);
    expect(course.publishedAt).toBeNull();
    expect(course.slug).toMatch(/^lap-trinh-nestjs-chuyen-sau-[a-z0-9]{6}$/);
    expect(course.level).toBe(CourseLevel.INTERMEDIATE);
  });

  it("should reject course creation when category is inactive [BR-CRS-01, BR-CAT-03]", async () => {
    await expect(
      coursesService.create(teacherAId, {
        title: "Course in Inactive Category",
        categoryId: inactiveCategoryId,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it("should prevent non-owners and non-admins from viewing draft courses [BR-CRS-03]", async () => {
    const course = await coursesService.create(teacherAId, {
      title: "Draft Course Details Test",
      categoryId: activeCategoryId,
    });

    // Owner can access
    const ownerView = await coursesService.findOne(course.id, {
      id: teacherAId,
      role: Role.TEACHER,
    });
    expect(ownerView.id).toBe(course.id);

    // Admin can access
    const adminView = await coursesService.findOne(course.id, {
      id: adminId,
      role: Role.ADMIN,
    });
    expect(adminView.id).toBe(course.id);

    // Other teacher cannot access
    await expect(
      coursesService.findOne(course.id, {
        id: teacherBId,
        role: Role.TEACHER,
      }),
    ).rejects.toThrow(ForbiddenException);

    // Unauthenticated request cannot access draft
    await expect(coursesService.findOne(course.id)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it("should list all owned courses across all statuses for teacher [FR-CO14]", async () => {
    const myCourses = await coursesService.findMyCourses(teacherAId);
    expect(myCourses.length).toBeGreaterThanOrEqual(2);
    expect(myCourses.every((c) => c.teacherId === teacherAId)).toBe(true);
  });

  it("should update course metadata and reject inactive category updates [BR-CRS-03]", async () => {
    const course = await coursesService.create(teacherAId, {
      title: "Course Update Test",
      categoryId: activeCategoryId,
    });

    const updated = await coursesService.update(course.id, {
      title: "Course Update Test (Modified)",
      level: CourseLevel.ADVANCED,
    });

    expect(updated.title).toBe("Course Update Test (Modified)");
    expect(updated.level).toBe(CourseLevel.ADVANCED);

    // Rejection on assigning inactive category
    await expect(
      coursesService.update(course.id, {
        categoryId: inactiveCategoryId,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it("should archive a course and prevent subsequent re-archiving [BR-CRS-04]", async () => {
    const course = await coursesService.create(teacherAId, {
      title: "Archive Candidate Course",
      categoryId: activeCategoryId,
    });

    const archived = await coursesService.archive(course.id);
    expect(archived.status).toBe(CourseStatus.ARCHIVED);

    // Attempting to archive an already archived course must fail [BR-CRS-04]
    await expect(coursesService.archive(course.id)).rejects.toThrow(
      BadRequestException,
    );
  });

  it("should allow unpublishing a course back to DRAFT", async () => {
    const course = await prisma.course.create({
      data: {
        title: "Published Course To Unpublish",
        slug: `unpublish-test-${timestamp}`,
        categoryId: activeCategoryId,
        teacherId: teacherAId,
        status: CourseStatus.PUBLISHED,
        publishedAt: new Date(),
      },
    });

    const reverted = await coursesService.unpublish(course.id);
    expect(reverted.status).toBe(CourseStatus.DRAFT);
  });

  it("should retrieve a course by UUID or by slug in findOne", async () => {
    const course = await prisma.course.create({
      data: {
        title: "Slug Query Test Course",
        slug: `slug-query-test-${timestamp}`,
        categoryId: activeCategoryId,
        teacherId: teacherAId,
        status: CourseStatus.PUBLISHED,
        publishedAt: new Date(),
      },
    });

    // Lookup by UUID
    const byId = await coursesService.findOne(course.id);
    expect(byId.id).toBe(course.id);

    // Lookup by Slug
    const bySlug = await coursesService.findOne(`slug-query-test-${timestamp}`);
    expect(bySlug.id).toBe(course.id);
    expect(bySlug.slug).toBe(`slug-query-test-${timestamp}`);
  });

  it("should mask videoUrl and fileUrl for guest/un-enrolled visitors while retaining metadata", async () => {
    const course = await prisma.course.create({
      data: {
        title: "Protected Content Course",
        slug: `protected-content-${timestamp}`,
        categoryId: activeCategoryId,
        teacherId: teacherAId,
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
                        title: "Intro Video",
                        videoUrl: "https://media.eduhub.local/videos/secret-video.mp4",
                        durationSeconds: 600,
                      },
                    },
                    resources: {
                      create: [
                        {
                          name: "Secret Slide.pdf",
                          fileUrl: "https://media.eduhub.local/resources/secret-slide.pdf",
                          fileType: "application/pdf",
                          fileSize: 1024,
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
    });

    // 1. Guest / Anonymous query -> videoUrl and fileUrl MUST be masked
    const guestView = await coursesService.findOne(course.id);
    const guestLesson = guestView.chapters[0].lessons[0];
    expect(guestLesson.title).toBe("Lesson 1");
    expect(guestLesson.video?.durationSeconds).toBe(600);
    expect((guestLesson.video as any)?.videoUrl).toBeUndefined();
    expect(guestLesson.resources[0].name).toBe("Secret Slide.pdf");
    expect((guestLesson.resources[0] as any)?.fileUrl).toBeUndefined();

    // 2. Owner teacher query -> videoUrl and fileUrl MUST be preserved
    const ownerView = await coursesService.findOne(course.id, {
      id: teacherAId,
      role: Role.TEACHER,
    });
    const ownerLesson = ownerView.chapters[0].lessons[0];
    expect(ownerLesson.video?.videoUrl).toBe("https://media.eduhub.local/videos/secret-video.mp4");
    expect(ownerLesson.resources[0].fileUrl).toBe("https://media.eduhub.local/resources/secret-slide.pdf");
  });
});
