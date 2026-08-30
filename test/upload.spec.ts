import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { TransformInterceptor } from "../src/common/interceptors/transform.interceptor";
import { HttpExceptionFilter } from "../src/common/filters/http-exception.filter";
import { CloudinaryService } from "../src/upload/cloudinary.service";
import { createPrismaClient } from "../src/lib/prisma";
import type { PrismaClient } from "../src/generated/prisma/client";

describe("Phase 3 - Part 4: Media Upload (Cloudinary)", () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let accessToken: string;

  const testUser = {
    email: `upload.test.${Date.now()}@eduhub.dev`,
    password: "Password123!",
    fullName: "Upload Test User",
  };

  beforeAll(async () => {
    prisma = createPrismaClient();
    await prisma.$connect();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(CloudinaryService)
      .useValue({
        uploadImage: vi.fn().mockImplementation(async (file: Express.Multer.File) => {
          if (!file.mimetype.startsWith("image/")) {
            throw new Error("Invalid image format");
          }
          return {
            url: "http://res.cloudinary.com/eduhub/image/upload/v1234/test.png",
            secureUrl: "https://res.cloudinary.com/eduhub/image/upload/v1234/test.png",
            publicId: "eduhub/images/test_image_123",
            format: "png",
            width: 800,
            height: 600,
          };
        }),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalInterceptors(new TransformInterceptor());
    app.useGlobalFilters(new HttpExceptionFilter());

    await app.init();

    // Register and login test user to obtain accessToken
    await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send(testUser);

    const loginRes = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({
        email: testUser.email,
        password: testUser.password,
      });

    accessToken = loginRes.body.data.accessToken;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: {
        email: {
          contains: "upload.test.",
        },
      },
    });
    await prisma.$disconnect();
    await app.close();
  });

  describe("POST /api/v1/upload/image", () => {
    it("should successfully upload an image file and return Cloudinary URLs when authenticated", async () => {
      // 1x1 transparent PNG buffer
      const pngBuffer = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        "base64",
      );

      const res = await request(app.getHttpServer())
        .post("/api/v1/upload/image")
        .set("Authorization", `Bearer ${accessToken}`)
        .attach("file", pngBuffer, "avatar.png");

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({
        secureUrl: expect.stringContaining("https://res.cloudinary.com/"),
        publicId: expect.any(String),
        format: "png",
      });
    });

    it("should reject upload with 400 Bad Request when no file is attached", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/upload/image")
        .set("Authorization", `Bearer ${accessToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should reject upload with 400 Bad Request when attached file is not an image (e.g. text file)", async () => {
      const textBuffer = Buffer.from("Hello world, this is a plain text file");

      const res = await request(app.getHttpServer())
        .post("/api/v1/upload/image")
        .set("Authorization", `Bearer ${accessToken}`)
        .attach("file", textBuffer, "document.txt");

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should reject upload with 401 Unauthorized when unauthenticated", async () => {
      const pngBuffer = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        "base64",
      );

      const res = await request(app.getHttpServer())
        .post("/api/v1/upload/image")
        .attach("file", pngBuffer, "avatar.png");

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });
});
