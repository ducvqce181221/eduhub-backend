import { describe, it, expect, beforeAll } from "vitest";
import { BadRequestException, InternalServerErrorException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { R2StorageService } from "../src/upload/r2-storage.service";
import { UploadFolder } from "../src/upload/dto/presigned-url.dto";

describe("Phase 5 - Part 1: Media Storage & Cloudflare R2 Presigned URLs", () => {
  let r2StorageService: R2StorageService;
  let mockConfigService: ConfigService;

  beforeAll(() => {
    mockConfigService = {
      get: (key: string) => {
        const config: Record<string, string> = {
          R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID || "test-account-id",
          R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID || "test-access-key",
          R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY || "test-secret-key",
          R2_BUCKET_NAME: process.env.R2_BUCKET_NAME || "test-eduhub-bucket",
          R2_PUBLIC_DOMAIN: process.env.R2_PUBLIC_DOMAIN || "https://media.eduhub.local",
        };
        return config[key];
      },
    } as unknown as ConfigService;

    r2StorageService = new R2StorageService(mockConfigService);
  });

  it("should successfully generate a presigned PUT URL for a video within size limits [FR-M02, FR-M03]", async () => {
    const result = await r2StorageService.generatePresignedPutUrl({
      fileName: "lesson-intro.mp4",
      fileType: "video/mp4",
      fileSize: 10 * 1024 * 1024, // 10MB
      folder: UploadFolder.VIDEOS,
    });

    expect(result).toBeDefined();
    expect(result.uploadUrl).toBeDefined();
    expect(result.uploadUrl).toContain(".r2.cloudflarestorage.com");
    expect(result.uploadUrl).not.toContain("x-amz-checksum");
    expect(result.uploadUrl).not.toContain("x-amz-sdk-checksum-algorithm");
    expect(result.fileUrl).toContain("/videos/");
    expect(result.key).toMatch(/^videos\/\d+-[a-z0-9_-]+-lesson-intro\.mp4$/i);
    expect(result.expiresIn).toBe(900);
  });

  it("should throw InternalServerErrorException when R2 configs are missing", async () => {
    const emptyConfigService = {
      get: () => undefined,
    } as unknown as ConfigService;

    const unconfiguredService = new R2StorageService(emptyConfigService);

    await expect(
      unconfiguredService.generatePresignedPutUrl({
        fileName: "lesson-intro.mp4",
        fileType: "video/mp4",
        fileSize: 1024,
        folder: UploadFolder.VIDEOS,
      }),
    ).rejects.toThrow(InternalServerErrorException);
  });

  it("should reject video upload with invalid non-video MIME type [FR-M03]", async () => {
    await expect(
      r2StorageService.generatePresignedPutUrl({
        fileName: "fake-video.txt",
        fileType: "text/plain",
        fileSize: 1024,
        folder: UploadFolder.VIDEOS,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it("should reject video upload exceeding 200MB limit [FR-M03]", async () => {
    const exceedsLimit = 201 * 1024 * 1024; // 201MB
    await expect(
      r2StorageService.generatePresignedPutUrl({
        fileName: "huge-video.mp4",
        fileType: "video/mp4",
        fileSize: exceedsLimit,
        folder: UploadFolder.VIDEOS,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it("should successfully generate presigned URL for downloadable resource within 50MB limit [FR-M02, FR-M03]", async () => {
    const result = await r2StorageService.generatePresignedPutUrl({
      fileName: "exercise-material.pdf",
      fileType: "application/pdf",
      fileSize: 5 * 1024 * 1024, // 5MB
      folder: UploadFolder.RESOURCES,
    });

    expect(result).toBeDefined();
    expect(result.fileUrl).toContain("/resources/");
    expect(result.key).toMatch(/^resources\//);
  });

  it("should reject resource upload exceeding 50MB limit [FR-M03]", async () => {
    const exceedsLimit = 51 * 1024 * 1024; // 51MB
    await expect(
      r2StorageService.generatePresignedPutUrl({
        fileName: "huge-archive.zip",
        fileType: "application/zip",
        fileSize: exceedsLimit,
        folder: UploadFolder.RESOURCES,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it("should extract R2 storage key from full public URL or relative path", () => {
    expect(
      r2StorageService.extractKeyFromUrl("https://media.eduhub.local/videos/123-intro.mp4"),
    ).toBe("videos/123-intro.mp4");
    expect(
      r2StorageService.extractKeyFromUrl("https://pub-r2.dev/resources/456-slide.pdf?v=1"),
    ).toBe("resources/456-slide.pdf");
    expect(r2StorageService.extractKeyFromUrl("https://youtube.com/watch?v=abc")).toBeNull();
  });

  it("should successfully generate a presigned GET URL with 15-minute expiration for video key", async () => {
    const signedUrl = await r2StorageService.generatePresignedGetUrl(
      "https://media.eduhub.local/videos/1788783914625-v6x-zoTW-1-lecture.mp4",
      900,
    );

    expect(signedUrl).toBeDefined();
    expect(signedUrl).toContain(".r2.cloudflarestorage.com");
    expect(signedUrl).toContain("/videos/");
    expect(signedUrl).toContain("X-Amz-Signature=");
    expect(signedUrl).toContain("X-Amz-Expires=900");
  });
});
