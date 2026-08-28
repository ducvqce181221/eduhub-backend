# 07 — Development Roadmap (Backend)
**Pre-Coding Documentation**
*Project:* EduHub — `eduhub-backend` | *Version:* 1.5 (split from combined v1.5 roadmap) | *Status:* Refined before coding

---

> **Repo scope note:** This roadmap covers the NestJS API only (Phases 1–10, plus the
> backend slice of 12–14). The Next.js client has its own roadmap at
> `eduhub-frontend/docs/07_Development_Roadmap.md` (Phase 11 there, plus its own slice of
> 12–14). Both roadmaps share the same phase numbers/names so the two repos stay easy to
> cross-reference even though they're built and versioned independently.

## 1. Roadmap Philosophy
Each phase follows a three-part discipline: **Learn**, **Build**, and **Test**. A phase is considered complete only when:
1. The developer can articulate the underlying backend principles and trade-offs.
2. The core feature functions end-to-end according to specifications.
3. Critical business logic has automated unit/integration tests written **within that phase** rather than delayed to the end.
4. Business validation rules conform strictly to `08_Business_Rules.md`.

---

## 2. Recommended Phase Progression (Backend)

```
+-------------------------------------------------------------------------------+
|  Phase 1: Foundation (NestJS + Docker)  -->  Phase 2: Prisma Schema & DB     |
+-------------------------------------------------------------------------------+
                                      |
                                      v
+-------------------------------------------------------------------------------+
|  Phase 3: Auth (JWT)  -->  Phase 4: Authorization (RBAC + Ownership)          |
+-------------------------------------------------------------------------------+
                                      |
                                      v
+-------------------------------------------------------------------------------+
|  Phase 5: Course Hierarchy & Publish  -->  Phase 6: Enrollment & Progress    |
+-------------------------------------------------------------------------------+
                                      |
                                      v
+-------------------------------------------------------------------------------+
|  Phase 7: Quiz & Grading  -->  Phase 8: Redis Cache  -->  Phase 9: RabbitMQ   |
+-------------------------------------------------------------------------------+
                                      |
                                      v
+-------------------------------------------------------------------------------+
|  Phase 10: Notifications & API Quality  -->  (Phase 11 lives in eduhub-frontend) |
+-------------------------------------------------------------------------------+
                                      |
                                      v
+-------------------------------------------------------------------------------+
|  Phase 12 (backend slice): CASL / OAuth callback / AI endpoint                 |
|  Phase 13 (backend slice): API E2E Test Suite                                 |
+-------------------------------------------------------------------------------+
                                      |
                                      v
+-------------------------------------------------------------------------------+
|                 Phase 14 (backend slice): API Deployment & Cloud DevOps        |
+-------------------------------------------------------------------------------+
```

---

## 3. Phase Breakdown

### Phase 1 — Project Foundation
- **Learn:** NestJS architecture, TypeScript modules, Dependency Injection, Controller/Service layers, Docker Compose essentials.
- **Build:** Initialize Git repository/folders, configure PostgreSQL, Redis, RabbitMQ in Docker Compose, configure NestJS environment config, implement `/api/v1/health` endpoint.
- **Test:** Health-check integration test validating database, cache, and broker connections.

### Phase 2 — Database & Persistence (Prisma ORM v7)
- **Learn:** Prisma Schema DSL, `@prisma/client` (v7), Prisma migrations (`pnpm prisma migrate dev`), Prisma Studio (`pnpm dlx prisma studio`), 1:N & 1:0..1 relations, cascade deletes, database seeding.
- **Build:** Define `schema.prisma` containing all 15 models and 5 enums (`Role`, `CourseLevel`, `CourseStatus`, `EnrollmentStatus`, `NotificationType`), run migration against PostgreSQL, implement `PrismaModule` & `PrismaService` in NestJS, verify models in Prisma Studio.
- **Test:** Migration verification tests, entity relation insertion and cascade deletion tests via Prisma Client.

### Phase 3 — Authentication & Identity
- **Learn:** Password hashing (Argon2 / bcrypt), JWT architecture, access vs refresh token lifecycle, HTTP-only cookie security, Passport strategies.
- **Build:** Student registration (`POST /auth/register`), login, refresh token rotation, logout, forgot/reset password token flow, profile endpoints (`GET /auth/me`, `PATCH /auth/me`) using `PrismaService`.
- **Test:** Unit tests for password hashing & JWT generation; integration tests for login validation, expired token rejection, and refresh rotation.

### Phase 4 — Authorization (RBAC & Ownership)
- **Learn:** Role-Based Access Control (RBAC), resource ownership verification, NestJS Custom Guards (`RolesGuard`, `OwnershipGuard`), ExecutionContext reflection.
- **Build:** Implement `Roles` decorator and guard for `STUDENT`, `TEACHER`, `ADMIN`; build ownership guard verifying `Course.teacherId === req.user.id` via `PrismaService`; protect administrative endpoints.
- **Test:** Permission matrix integration tests: verify Student cannot edit courses; Teacher A cannot modify Teacher B's course; Admin can access any course.

### Phase 5 — Course Content & Publishing
- **Learn:** Hierarchical data handling with Prisma nested reads (`include`) / writes (`create`), deterministic slug generation (`nanoid`), batch reordering inside `prisma.$transaction`, sequential order calculation, Publish-Ready Checklist validator pattern, curriculum floor protection.
- **Build:** Chapter and lesson CRUD (auto-increment sequential `order`); batch reordering endpoints (`PATCH /courses/:id/chapters/reorder`, `PATCH /chapters/:id/lessons/reorder`); video upsert (`PUT /lessons/:id/video`); resource management (`fileSize` as Int); `GET /me/courses` for teachers; Course publish endpoint (`PATCH /courses/:id/publish`) validating $\ge 1$ chapter, $\ge 1$ lesson, and valid video per lesson; archive course endpoint (`PATCH /courses/:id/archive` supporting DRAFT and PUBLISHED courses); delete chapter/lesson floor guard.
- **Test:** Validation tests for the 5-point Publish Checklist; Category delete rejection test when courses exist (409 Conflict); batch reordering unique index collision tests; published curriculum floor deletion rejection tests (400 Bad Request).

### Phase 6 — Enrollment & Progress Tracking
- **Learn:** State machine modeling, incremental heartbeat sync & clamping, automatic completion evaluation, derived progress calculation with single-query SQL aggregation (Anti-N+1), real-time teacher reporting.
- **Build:** Course enrollment (`POST /courses/:courseId/enroll`), lesson progress heartbeat (`PUT /lessons/:lessonId/progress`) with clamping, automatic lesson completion logic ($\ge 90\%$ duration + passing quiz), `course.completed` domain event trigger, student course progress summary (`GET /me/progress/courses/:courseId`), teacher enrolled student progress reporting (`GET /courses/:courseId/students`).
- **Test:** Progress calculation unit tests: verify heartbeat clamping; verify lesson is incomplete at 89% watch duration, completed at 90%+ duration; verify real-time single-query SQL progress aggregation for teacher reporting; verify `course.completed` event trigger at 100% completion.

### Phase 7 — Quiz & Server-Side Scoring
- **Learn:** Nested input validation, DTO response masking (`isCorrect` security), Prisma Interactive Transactions (`prisma.$transaction(async (tx) => { ... })`), scoring algorithm, pass/fail thresholds.
- **Build:** Quiz management (0..1 per lesson, `PassScore` percentage), single-choice question/answer CRUD, atomic quiz submission endpoint (`POST /quizzes/:quizId/attempts`) calculating float score percentage, recording attempt history, and updating lesson/course completion inside a Prisma transaction.
- **Test:** Scoring algorithm unit tests: 100% correct, partial score, 0% score; pass/fail threshold boundary tests (e.g. 79% fail vs 80% pass); attempt recording transaction integrity test; quiz DTO answer masking security test.

### Phase 8 — Redis Caching & Rate Limiting
- **Learn:** Redis data structures, Cache-Aside pattern, TTL configuration, cache invalidation strategies, Redis Throttler.
- **Build:** Redis caching on course discovery (`GET /courses`), cache invalidation upon course mutations/publishing (`courses:list:*`), Redis-backed rate limiting on `/auth/login`, `/auth/register`, `/auth/forgot-password`, `/auth/reset-password`.
- **Test:** Cache hit/miss integration tests; verify cache invalidation upon course update; rate-limiting burst test (HTTP 429 Too Many Requests).

### Phase 9 — RabbitMQ Asynchronous Events
- **Learn:** Message broker architecture, exchanges, queues, routing keys, manual acknowledgements, consumer retries, Dead-Letter Queues (DLQ).
- **Build:** Event publisher in NestJS; dispatch `course.enrolled`, `quiz.submitted`, and `course.completed` events; build asynchronous Notification consumer worker writing to PostgreSQL via `PrismaService` (`NotificationType` enum); configure DLQ.
- **Test:** Event delivery integration tests; verify `course.completed` notification generation; simulate consumer failure and verify retry and DLQ routing.

### Phase 10 — Notifications & API Quality
- **Learn:** Standard API response formatting, global exception filtering, Swagger/OpenAPI documentation.
- **Build:** Notification query and read endpoints (`/notifications`, `PATCH /notifications/:id/read`); Global `TransformInterceptor` wrapping `{ success, data, meta }`; Global `HttpExceptionFilter`; complete Swagger documentation annotations.
- **Test:** Interceptor and Exception Filter format verification tests.

> Phase 11 (Frontend Web Application) is out of scope for this repo — see
> `eduhub-frontend/docs/07_Development_Roadmap.md`.

### Phase 12 — Advanced Optional Extensions (backend slice)
- **Learn:** CASL fine-grained abilities, Google OAuth2 server-side callback/token exchange, AI integration (course summary generation endpoint).
- **Build:** Selectively implement: CASL ability factory (replacing/augmenting `RolesGuard`), Google OAuth2 strategy + callback endpoint issuing the same JWT pair as password login, or an AI course-summary endpoint (`POST /courses/:id/ai-summary` or similar) wrapping an LLM call.
- **Test:** Extension-specific unit and integration tests.
- *Note:* Any corresponding UI (OAuth login button, AI summary display) is tracked in the frontend repo's own Phase 12 slice.

### Phase 13 — API End-to-End Testing & Docs Packaging (backend slice)
- **Learn:** E2E test orchestration (supertest-based full-stack API tests), load testing basics, documentation engineering.
- **Build:** Full student learning flow E2E test suite at the API level (register → browse → enroll → watch/progress → quiz → completion); comprehensive backend README.md, ERD diagram, API architecture documentation.
- **Test:** Run full automated API test suite with coverage report.
- *Note:* The frontend repo runs its own browser-level E2E suite (Playwright/Cypress) against a running instance of this API — see its Phase 13 slice.

### Phase 14 — Deployment & Cloud DevOps (backend slice)
- **Learn:** Docker multi-stage builds, Linux VPS administration, Nginx reverse proxy, SSL/TLS Let's Encrypt certificates, CI/CD pipelines (GitHub Actions), database backups.
- **Build:** Production Dockerfile for the NestJS API, Oracle Cloud Free / Render deployment of the API + PostgreSQL + Redis + RabbitMQ, automated CI/CD deployment pipeline for this repo, SSL/reverse-proxy configuration in front of the API, health check monitoring (`/api/v1/health`), backup scripts for PostgreSQL.
- **Test:** Production smoke tests against live API, liveness probe verification, automated deployment validation.
- *Note:* Frontend deployment (Vercel or static hosting) is tracked in the frontend repo's own Phase 14 slice; the two are coordinated via the API base URL environment variable.
