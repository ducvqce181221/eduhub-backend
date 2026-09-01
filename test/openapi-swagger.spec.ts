import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import type { INestApplication } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "../src/prisma/prisma.module";
import { HealthModule } from "../src/health/health.module";
import { AuthModule } from "../src/auth/auth.module";
import { UsersModule } from "../src/users/users.module";
import { CategoriesModule } from "../src/categories/categories.module";
import { CoursesModule } from "../src/courses/courses.module";
import { ChaptersModule } from "../src/chapters/chapters.module";
import { LessonsModule } from "../src/lessons/lessons.module";
import { EnrollmentsModule } from "../src/enrollments/enrollments.module";
import { ProgressModule } from "../src/progress/progress.module";
import { QuizzesModule } from "../src/quizzes/quizzes.module";
import { NotificationsModule } from "../src/notifications/notifications.module";
import { UploadModule } from "../src/upload/upload.module";

describe("Phase 10 - Cụm 3: OpenAPI / Swagger Documentation Verification", () => {
  let app: INestApplication;
  let swaggerDocument: any;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        PrismaModule,
        HealthModule,
        AuthModule,
        UsersModule,
        CategoriesModule,
        CoursesModule,
        ChaptersModule,
        LessonsModule,
        EnrollmentsModule,
        ProgressModule,
        QuizzesModule,
        NotificationsModule,
        UploadModule,
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1");

    const swaggerConfig = new DocumentBuilder()
      .setTitle("EduHub API")
      .setDescription("The EduHub Learning Management System REST API Documentation")
      .setVersion("1.0")
      .addBearerAuth()
      .build();

    swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it("should generate a valid OpenAPI 3.0 document with title and version", () => {
    expect(swaggerDocument).toBeDefined();
    expect(swaggerDocument.openapi).toMatch(/^3\./);
    expect(swaggerDocument.info.title).toBe("EduHub API");
    expect(swaggerDocument.info.version).toBe("1.0");
  });

  it("should include all essential API endpoint paths including Notifications", () => {
    const paths = Object.keys(swaggerDocument.paths);

    expect(paths).toContain("/api/v1/notifications");
    expect(paths).toContain("/api/v1/notifications/read-all");
    expect(paths).toContain("/api/v1/notifications/{id}/read");
    expect(paths).toContain("/api/v1/notifications/system");
    expect(paths).toContain("/api/v1/auth/login");
    expect(paths).toContain("/api/v1/courses");
    expect(paths).toContain("/api/v1/health");
  });

  it("should include Notifications tag and operations in OpenAPI specification", () => {
    const notifPath = swaggerDocument.paths["/api/v1/notifications"];
    expect(notifPath).toBeDefined();
    expect(notifPath.get).toBeDefined();
    expect(notifPath.get.tags).toContain("Notifications");
    expect(notifPath.get.summary).toBeDefined();

    const systemNotifPath = swaggerDocument.paths["/api/v1/notifications/system"];
    expect(systemNotifPath).toBeDefined();
    expect(systemNotifPath.post).toBeDefined();
    expect(systemNotifPath.post.tags).toContain("Notifications");
  });

  it("should have schemas for DTOs in components.schemas", () => {
    const schemas = swaggerDocument.components?.schemas;
    expect(schemas).toBeDefined();
    expect(schemas?.CreateSystemNotificationDto).toBeDefined();
  });
});
