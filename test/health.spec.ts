import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { TransformInterceptor } from "../src/common/interceptors/transform.interceptor";
import { HttpExceptionFilter } from "../src/common/filters/http-exception.filter";

describe("Health Check & API Foundation (Phase 1)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

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
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /api/v1/health should return 200 OK with connected status for DB, Redis, RabbitMQ", async () => {
    const res = await request(app.getHttpServer()).get("/api/v1/health");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      data: {
        status: "ok",
        database: "connected",
        redis: "connected",
        rabbitmq: "connected",
      },
    });
    expect(res.body.data.timestamp).toBeDefined();
  });

  it("GET /api/v1/non-existent-route should return standard error envelope with 404", async () => {
    const res = await request(app.getHttpServer()).get("/api/v1/non-existent-route");

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({
      success: false,
      statusCode: 404,
      error: "Not Found",
    });
    expect(res.body.timestamp).toBeDefined();
    expect(res.body.path).toBe("/api/v1/non-existent-route");
  });
});
