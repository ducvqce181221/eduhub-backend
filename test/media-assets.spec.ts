import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { createPrismaClient } from "../src/lib/prisma";
import type { PrismaClient } from "../src/generated/prisma/client";
import { Role, MediaType, AssetSource } from "../src/generated/prisma/client";
import { MediaAssetsService } from "../src/media-assets/media-assets.service";
import { ResourcesService } from "../src/lessons/resources.service";
import { LessonsService } from "../src/lessons/lessons.service";
import { UploadController } from "../src/upload/upload.controller";
import {
  isPrivateIp,
  validateAndInspectExternalUrl,
} from "../src/common/utils/url-validator.util";

describe("Media Assets Library, Deduplication & External URLs", () => {
  let prisma: PrismaClient;
  let mediaAssetsService: MediaAssetsService;
  let resourcesService: ResourcesService;
  let lessonsService: LessonsService;
  let uploadController: UploadController;

  let teacher1Id: string;
  let teacher2Id: string;
  let adminId: string;
  let testCourseId: string;
  let testChapterId: string;
  let testLessonId: string;

  const timestamp = Date.now();

  beforeAll(async () => {
    prisma = createPrismaClient();
    await prisma.$connect();

    mediaAssetsService = new MediaAssetsService(prisma);
    resourcesService = new ResourcesService(prisma);
    lessonsService = new LessonsService(prisma);
    uploadController = new UploadController({} as any, {} as any, prisma);

    // Create Teacher 1
    const t1 = await prisma.user.create({
      data: {
        email: `teacher1_asset_${timestamp}@eduhub.test`,
        passwordHash: "hash123",
        fullName: "Teacher One",
        role: Role.TEACHER,
      },
    });
    teacher1Id = t1.id;

    // Create Teacher 2
    const t2 = await prisma.user.create({
      data: {
        email: `teacher2_asset_${timestamp}@eduhub.test`,
        passwordHash: "hash123",
        fullName: "Teacher Two",
        role: Role.TEACHER,
      },
    });
    teacher2Id = t2.id;

    // Create Admin
    const adm = await prisma.user.create({
      data: {
        email: `admin_asset_${timestamp}@eduhub.test`,
        passwordHash: "hash123",
        fullName: "Admin User",
        role: Role.ADMIN,
      },
    });
    adminId = adm.id;

    // Create Category & Course for Teacher 1
    const category = await prisma.category.create({
      data: {
        name: `AssetCategory_${timestamp}`,
        slug: `asset-cat-${timestamp}`,
      },
    });

    const course = await prisma.course.create({
      data: {
        title: "Asset Course 101",
        slug: `asset-course-101-${timestamp}`,
        categoryId: category.id,
        teacherId: teacher1Id,
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

    testCourseId = course.id;
    testChapterId = course.chapters[0].id;
    testLessonId = course.chapters[0].lessons[0].id;
  });

  afterAll(async () => {
    await prisma.resource.deleteMany({ where: { lesson: { chapter: { courseId: testCourseId } } } });
    await prisma.video.deleteMany({ where: { lesson: { chapter: { courseId: testCourseId } } } });
    await prisma.course.deleteMany({ where: { id: testCourseId } });
    await prisma.mediaAsset.deleteMany({
      where: { uploaderId: { in: [teacher1Id, teacher2Id, adminId] } },
    });
    await prisma.category.deleteMany({ where: { slug: `asset-cat-${timestamp}` } });
    await prisma.user.deleteMany({ where: { id: { in: [teacher1Id, teacher2Id, adminId] } } });
    await prisma.$disconnect();
  });

  describe("1. URL Validator & SSRF Protection (url-validator.util.ts)", () => {
    it("should correctly identify private and loopback IPv4/IPv6 addresses", () => {
      expect(isPrivateIp("127.0.0.1")).toBe(true);
      expect(isPrivateIp("10.0.0.5")).toBe(true);
      expect(isPrivateIp("172.16.0.1")).toBe(true);
      expect(isPrivateIp("172.31.255.255")).toBe(true);
      expect(isPrivateIp("192.168.1.1")).toBe(true);
      expect(isPrivateIp("169.254.169.254")).toBe(true);
      expect(isPrivateIp("::1")).toBe(true);

      // Public IPs
      expect(isPrivateIp("8.8.8.8")).toBe(false);
      expect(isPrivateIp("1.1.1.1")).toBe(false);
      expect(isPrivateIp("104.21.50.1")).toBe(false);
    });

    it("should reject non-HTTP(S) schemes (e.g. ftp, javascript)", async () => {
      await expect(validateAndInspectExternalUrl("ftp://files.example.com/doc.pdf")).rejects.toThrow(
        BadRequestException,
      );
      await expect(validateAndInspectExternalUrl("javascript:alert(1)")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("should block localhost and private hostnames", async () => {
      await expect(validateAndInspectExternalUrl("http://localhost:3000/api")).rejects.toThrow(
        BadRequestException,
      );
      await expect(validateAndInspectExternalUrl("http://127.0.0.1:8080/secret")).rejects.toThrow(
        BadRequestException,
      );
      await expect(validateAndInspectExternalUrl("http://app.localhost/doc")).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe("2. SHA-256 Duplicate Detection (UploadController checkDuplicate)", () => {
    const sampleHash = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2";

    beforeAll(async () => {
      // Create an asset in Teacher 1's library with sampleHash
      await prisma.mediaAsset.create({
        data: {
          uploaderId: teacher1Id,
          name: "Teacher1-Slide.pdf",
          fileUrl: "https://media.local/resources/t1-slide.pdf",
          fileType: "application/pdf",
          fileSize: 1048576,
          contentHash: sampleHash,
          source: AssetSource.R2_UPLOAD,
          mediaType: MediaType.DOCUMENT,
        },
      });
    });

    it("should return isDuplicate: true when Teacher 1 checks their own uploaded file", async () => {
      const result = await uploadController.checkDuplicate(
        { hash: sampleHash, mediaType: MediaType.DOCUMENT },
        { user: { id: teacher1Id, role: Role.TEACHER } } as any,
      );

      expect(result.isDuplicate).toBe(true);
      expect(result.asset).toBeDefined();
      expect(result.asset?.name).toBe("Teacher1-Slide.pdf");
    });

    it("should return isDuplicate: false when Teacher 2 checks the same hash (Per-Teacher Scope)", async () => {
      const result = await uploadController.checkDuplicate(
        { hash: sampleHash, mediaType: MediaType.DOCUMENT },
        { user: { id: teacher2Id, role: Role.TEACHER } } as any,
      );

      expect(result.isDuplicate).toBe(false);
      expect(result.asset).toBeNull();
    });

    it("should return isDuplicate: true when Admin checks (Global Scope)", async () => {
      const result = await uploadController.checkDuplicate(
        { hash: sampleHash, mediaType: MediaType.DOCUMENT },
        { user: { id: adminId, role: Role.ADMIN } } as any,
      );

      expect(result.isDuplicate).toBe(true);
      expect(result.asset).toBeDefined();
    });
  });

  describe("3. MediaAssetsService (Library Browse, External URLs & Delete Safeguards)", () => {
    let createdAssetId: string;

    it("should browse and search teacher assets with pagination and usageCount", async () => {
      const result = await mediaAssetsService.findAll(
        { page: 1, limit: 10, search: "Slide" },
        { id: teacher1Id, role: Role.TEACHER },
      );

      expect(result.items.length).toBeGreaterThanOrEqual(1);
      expect(result.items[0].name).toContain("Slide");
      expect(result.meta.page).toBe(1);
      expect(result.meta.total).toBeGreaterThanOrEqual(1);
    });

    it("should create an external asset when URL is valid and reachable", async () => {
      // Mock global fetch to simulate external reachability
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockResolvedValue({
        status: 200,
        statusText: "OK",
        headers: new Headers({
          "content-type": "application/pdf",
          "content-length": "2048",
        }),
      } as any);

      const created = await mediaAssetsService.createExternal(
        {
          name: "NestJS PDF Guide",
          url: "https://nestjs.com/guide.pdf",
          mediaType: MediaType.DOCUMENT,
        },
        { id: teacher1Id, role: Role.TEACHER },
      );

      global.fetch = originalFetch;

      expect(created.id).toBeDefined();
      expect(created.source).toBe(AssetSource.EXTERNAL_URL);
      expect(created.fileType).toBe("application/pdf");
      createdAssetId = created.id;
    });

    it("should delete an unattached media asset from library", async () => {
      const del = await mediaAssetsService.remove(createdAssetId, {
        id: teacher1Id,
        role: Role.TEACHER,
      });
      expect(del.message).toBe("Media asset deleted successfully from library");

      const check = await prisma.mediaAsset.findUnique({ where: { id: createdAssetId } });
      expect(check).toBeNull();
    });
  });

  describe("4. Attach from Library to Lesson (Resources & Video)", () => {
    let sharedDocAssetId: string;
    let sharedVideoAssetId: string;

    beforeAll(async () => {
      const doc = await prisma.mediaAsset.create({
        data: {
          uploaderId: teacher1Id,
          name: "CheatSheet.pdf",
          fileUrl: "https://media.local/resources/cheatsheet.pdf",
          fileType: "application/pdf",
          fileSize: 512000,
          source: AssetSource.R2_UPLOAD,
          mediaType: MediaType.DOCUMENT,
        },
      });
      sharedDocAssetId = doc.id;

      const vid = await prisma.mediaAsset.create({
        data: {
          uploaderId: teacher1Id,
          name: "Intro Lecture.mp4",
          fileUrl: "https://media.local/videos/intro.mp4",
          fileType: "video/mp4",
          durationSeconds: 360,
          source: AssetSource.R2_UPLOAD,
          mediaType: MediaType.VIDEO,
        },
      });
      sharedVideoAssetId = vid.id;
    });

    it("should attach an existing resource from library to lesson", async () => {
      const resource = await resourcesService.attachFromLibrary(
        testLessonId,
        { assetId: sharedDocAssetId, customName: "Lesson 1 CheatSheet" },
        { id: teacher1Id, role: Role.TEACHER },
      );

      expect(resource.id).toBeDefined();
      expect(resource.name).toBe("Lesson 1 CheatSheet");
      expect(resource.assetId).toBe(sharedDocAssetId);
      expect(resource.fileUrl).toBe("https://media.local/resources/cheatsheet.pdf");
      expect(resource.fileSize).toBe(512000);
    });

    it("should block deleting an asset from library while attached to a lesson", async () => {
      await expect(
        mediaAssetsService.remove(sharedDocAssetId, { id: teacher1Id, role: Role.TEACHER }),
      ).rejects.toThrow(BadRequestException);
    });

    it("should prevent Teacher 2 from attaching Teacher 1's asset", async () => {
      await expect(
        resourcesService.attachFromLibrary(
          testLessonId,
          { assetId: sharedDocAssetId },
          { id: teacher2Id, role: Role.TEACHER },
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it("should attach an existing video from library to lesson", async () => {
      const video = await lessonsService.attachVideoFromLibrary(
        testLessonId,
        { assetId: sharedVideoAssetId, customTitle: "Lesson 1 Video Lecture" },
        { id: teacher1Id, role: Role.TEACHER },
      );

      expect(video.id).toBeDefined();
      expect(video.title).toBe("Lesson 1 Video Lecture");
      expect(video.videoUrl).toBe("https://media.local/videos/intro.mp4");
      expect(video.durationSeconds).toBe(360);
      expect(video.assetId).toBe(sharedVideoAssetId);
    });

    it("should reject attaching a document asset as a lesson video", async () => {
      await expect(
        lessonsService.attachVideoFromLibrary(
          testLessonId,
          { assetId: sharedDocAssetId },
          { id: teacher1Id, role: Role.TEACHER },
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("5. Auto-Registration of Direct Uploads into MediaAsset Library", () => {
    it("should automatically register new resource upload into teacher's library with hash", async () => {
      const hash = "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
      const createdResource = await resourcesService.create(testLessonId, {
        name: "Direct Upload PDF",
        fileUrl: "https://media.local/resources/direct.pdf",
        fileType: "application/pdf",
        fileSize: 1024,
        contentHash: hash,
      });

      expect(createdResource.assetId).toBeDefined();

      const asset = await prisma.mediaAsset.findUnique({
        where: { id: createdResource.assetId! },
      });
      expect(asset).not.toBeNull();
      expect(asset?.uploaderId).toBe(teacher1Id);
      expect(asset?.contentHash).toBe(hash);
      expect(asset?.mediaType).toBe(MediaType.DOCUMENT);
    });

    it("should automatically register new video upload into teacher's library with hash", async () => {
      const hash = "fedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321";
      const createdVideo = await lessonsService.upsertVideo(testLessonId, {
        title: "Direct Video Lecture",
        videoUrl: "https://media.local/videos/direct.mp4",
        durationSeconds: 500,
        contentHash: hash,
      });

      expect(createdVideo.assetId).toBeDefined();

      const asset = await prisma.mediaAsset.findUnique({
        where: { id: createdVideo.assetId! },
      });
      expect(asset).not.toBeNull();
      expect(asset?.uploaderId).toBe(teacher1Id);
      expect(asset?.contentHash).toBe(hash);
      expect(asset?.durationSeconds).toBe(500);
      expect(asset?.mediaType).toBe(MediaType.VIDEO);
    });
  });
});
