---
trigger: model_decision
description: Use when creating or updating REST endpoints, DTOs, or controller responses.
---

`docs/05_API_Design.md` serves as the authoritative source for: base path `/api/v1`, response envelope format, status code conventions, and payload samples (batch reordering, quiz submissions, student progress reports).

Every controller must:
- Return responses wrapped via the standard `TransformInterceptor` as `{ success, data, meta? }`; errors via the standard `HttpExceptionFilter` as `{ success: false, statusCode, message, error, timestamp, path }`.
- Adhere strictly to the status code matrix in `05_API_Design.md` §3:
  - **422 is used EXCLUSIVELY for Publish Checklist failures** (`PATCH /courses/:id/publish`).
  - All other business rule violations (e.g. deleting the last chapter of a published course, enrolling in an unpublished course, negative watch progress...) **must return 400 Bad Request** — never generalize 422 to generic business rule violations.
  - `409 Conflict` is reserved for unique constraint collisions (email, slug, category deletion with attached courses).
- Apply `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })` globally.
- Provide comprehensive Swagger decorators for every route (request/response schemas, status codes).
- **Explicit OpenAPI Typing:** Because the dev engine runs on `tsx` (esbuild), always explicitly provide `type`, `example`, and `description` in `@ApiProperty({ type: String, ... })` and use `@ApiBody({ type: TargetDto })` on controller mutation endpoints to guarantee 100% reliable OpenAPI schema generation.
- **Defensive Service Validation:** Service methods must validate input payload presence and throw `BadRequestException` on missing/null bodies.