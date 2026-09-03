import "reflect-metadata";
import "dotenv/config";

import cookieParser from "cookie-parser";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { TransformInterceptor } from "./common/interceptors/transform.interceptor";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS with credentials for frontend client
  const frontendUrl = (process.env.FRONTEND_URL ?? "http://localhost:3000").trim();
  app.enableCors({
    origin: [frontendUrl, "http://localhost:3000", "http://127.0.0.1:3000"],
    credentials: true,
  });

  // Cookie parser middleware
  app.use(cookieParser());

  // Global prefix
  app.setGlobalPrefix("api/v1");

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global interceptor & filter
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  // Swagger Documentation
  const swaggerConfig = new DocumentBuilder()
    .setTitle("EduHub API")
    .setDescription("The EduHub Learning Management System REST API Documentation")
    .setVersion("1.0")
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("api/docs", app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  // Serve swagger json endpoint for type generation (/api/docs-json)
  const httpAdapter = app.getHttpAdapter();
  httpAdapter.get("/api/docs-json", (_req: any, res: any) => {
    res.json(document);
  });

  const rawPort = (process.env.PORT ?? "").trim();
  const parsedPort = rawPort.length > 0 ? Number(rawPort) : Number.NaN;
  const port =
    Number.isFinite(parsedPort) && parsedPort >= 0 && parsedPort <= 65535 ? parsedPort : 3000;

  await app.listen(port, "0.0.0.0");
  console.log(`EduHub API is running at http://localhost:${port}/api/v1`);
  console.log(`Swagger UI is available at http://localhost:${port}/api/docs`);
  console.log(`Swagger JSON is available at http://localhost:${port}/api/docs-json`);
}

bootstrap().catch((error) => {
  console.error("Failed to start server", error);
  process.exit(1);
});
