import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ConflictException, NotFoundException } from "@nestjs/common";
import { CategoriesService } from "../src/categories/categories.service";
import { createPrismaClient } from "../src/lib/prisma";
import type { PrismaClient } from "../src/generated/prisma/client";
import { Role } from "../src/generated/prisma/client";

describe("Phase 5 - Part 2: Category Management & Safeguards", () => {
  let prisma: PrismaClient;
  let categoriesService: CategoriesService;
  let teacherId: string;
  const timestamp = Date.now();

  beforeAll(async () => {
    prisma = createPrismaClient();
    categoriesService = new CategoriesService(prisma as any);

    // Create a mock teacher for course attachment tests
    const teacher = await prisma.user.create({
      data: {
        email: `teacher_cat_${timestamp}@eduhub.test`,
        passwordHash: "hash",
        fullName: "Category Teacher",
        role: Role.TEACHER,
      },
    });
    teacherId = teacher.id;
  });

  afterAll(async () => {
    // Clean up created entities
    await prisma.course.deleteMany({
      where: { teacherId },
    });
    await prisma.category.deleteMany({
      where: {
        name: { contains: `TestCat_${timestamp}` },
      },
    });
    await prisma.user.deleteMany({
      where: { id: teacherId },
    });
  });

  it("should create a category with auto-generated slug [BR-CAT-01]", async () => {
    const category = await categoriesService.create({
      name: `TestCat_${timestamp} Backend Development`,
      description: "Learn server-side technologies",
    });

    expect(category).toBeDefined();
    expect(category.id).toBeDefined();
    expect(category.name).toBe(`TestCat_${timestamp} Backend Development`);
    expect(category.slug).toBe(`testcat-${timestamp}-backend-development`);
    expect(category.isActive).toBe(true);
  });

  it("should prevent duplicate category name or slug [BR-CAT-01]", async () => {
    await expect(
      categoriesService.create({
        name: `TestCat_${timestamp} Backend Development`,
      }),
    ).rejects.toThrow(ConflictException);
  });

  it("should update category details and toggle active state [BR-CAT-03]", async () => {
    const category = await categoriesService.create({
      name: `TestCat_${timestamp} Mobile Dev`,
    });

    const updated = await categoriesService.update(category.id, {
      description: "iOS & Android",
      isActive: false,
    });

    expect(updated.description).toBe("iOS & Android");
    expect(updated.isActive).toBe(false);
  });

  it("should filter inactive categories by default [BR-CAT-03]", async () => {
    const activeCategories = await categoriesService.findAll(true);
    const hasInactive = activeCategories.some((c) => c.isActive === false);
    expect(hasInactive).toBe(false);

    const allCategories = await categoriesService.findAll(false);
    const hasInactiveInAll = allCategories.some((c) => c.isActive === false);
    expect(hasInactiveInAll).toBe(true);
  });

  it("should prevent deleting a category when active courses reference it [BR-CAT-02]", async () => {
    const category = await categoriesService.create({
      name: `TestCat_${timestamp} Cloud Architecture`,
    });

    // Attach a course to this category
    await prisma.course.create({
      data: {
        title: "AWS & Docker Mastery",
        slug: `aws-docker-${timestamp}`,
        categoryId: category.id,
        teacherId,
      },
    });

    // Attempting to delete category with courses must fail with 409 Conflict
    await expect(categoriesService.remove(category.id)).rejects.toThrow(
      ConflictException,
    );
  });

  it("should allow deleting a category when 0 courses reference it [BR-CAT-02]", async () => {
    const category = await categoriesService.create({
      name: `TestCat_${timestamp} Empty Category`,
    });

    const result = await categoriesService.remove(category.id);
    expect(result.message).toBe("Category deleted successfully");

    await expect(categoriesService.findOne(category.id)).rejects.toThrow(
      NotFoundException,
    );
  });
});
