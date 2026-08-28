# 06 — System Architecture
**Pre-Coding Documentation**  
*Project:* EduHub | *Version:* 1.4 | *Status:* Refined before coding

---

## 1. Architecture Overview
EduHub is designed as a clean, modular monolith backend built with NestJS and TypeScript, serving a modern Next.js web application. PostgreSQL is the primary relational database and sole source of truth. Prisma ORM provides type-safe schema modeling, migrations, and data access. Redis acts as a high-speed in-memory store for catalog caching, rate limiting, and temporary token states. RabbitMQ provides asynchronous, decoupled messaging for non-blocking operations like notification delivery.

```
+-------------------------------------------------------------------------+
|                              Next.js Web UI                             |
|          (Student Dashboard, Teacher Dashboard, Learning Player)         |
+------------------------------------+------------------------------------+
                                     |  HTTP / REST (JWT Bearer)
                                     v
+-------------------------------------------------------------------------+
|                               NestJS API                                |
|  [Global Exception Filter] <---> [Global Transform Interceptor]         |
|  [JwtAuthGuard] -> [RolesGuard] -> [Ownership / Enrollment Guard]       |
|  [ValidationPipe (class-validator)]                                     |
|  [Modules: Auth, Users, Categories, Courses, Chapters, Lessons, Quizzes] |
+-----------+------------------------+------------------------+-----------+
            |                        |                        |
            | PrismaService          | Redis Client           | amqplib
            v                        v                        v
+-----------------------+  +-------------------+  +-----------------------+
|  PostgreSQL Database  |  |    Redis Store    |  |   RabbitMQ Broker     |
| (Source of Truth, FKs,|  | (Discovery Cache, |  | (Exchange, Queues,    |
|  ACID Transactions)   |  |  Rate Limiting)   |  |  Dead-Letter Queue)   |
+-----------------------+  +-------------------+  +-----------+-----------+
                                                              |
                                                              v
                                                   +----------------------+
                                                   | Notification Worker  |
                                                   | (Async Event Handler)|
                                                   +----------------------+
```

---

## 2. Component Responsibilities

| Component | Technology | Responsibility | Communication |
| :--- | :--- | :--- | :--- |
| **Frontend** | Next.js + TypeScript | Client UI, route guards, player heartbeat syncing, student & teacher dashboards. | HTTP/REST to NestJS API |
| **Backend API** | NestJS + TypeScript | Business logic, authentication, authorization (RBAC + Ownership), validation, transactions. | PrismaService, Redis, RabbitMQ |
| **Database** | PostgreSQL | Relational persistence, constraints, foreign keys, ACID transactions. | PostgreSQL engine |
| **ORM** | Prisma ORM | Central `schema.prisma`, type-safe client generation, migrations, interactive transactions. | NestJS ↔ PostgreSQL |
| **Cache & Session** | Redis | Caching published course catalog (`GET /courses`), rate-limiting auth endpoints, token blacklisting. | NestJS ↔ Redis |
| **Message Broker** | RabbitMQ | Decoupling asynchronous domain events (`course.enrolled`, `quiz.submitted`, `course.completed`). | NestJS Producer ↔ Queues |
| **Async Consumer** | NestJS Worker | Consumes domain events, persists notification entities in PostgreSQL via `PrismaService`. | RabbitMQ ↔ PostgreSQL |
| **API Docs** | Swagger / OpenAPI | Interactive API documentation generated from TypeScript decorators. | Served at `/api/docs` |
| **Infrastructure**| Docker Compose | Local containerized orchestration of PostgreSQL, Redis, and RabbitMQ. | Local environment |

---

## 3. NestJS Request Pipeline Architecture

Every incoming HTTP request flows through a unified processing pipeline:
1. **Global Rate Limiter (Throttler with Redis):** Mitigates brute-force attacks on sensitive paths (`/auth/login`, `/auth/register`, `/auth/forgot-password`, `/auth/reset-password`).
2. **`JwtAuthGuard`:** Extracts Bearer token, validates signature/expiration, attaches authenticated `UserPayload` to `req.user`.
3. **`RolesGuard`:** Verifies `@Roles()` decorator against `req.user.role` (`STUDENT`, `TEACHER`, `ADMIN`).
4. **Ownership / Enrollment Guard:**
   - For Teacher resources: Checks `entity.teacherId === req.user.id` (Admin bypasses).
   - For Student learning resources: Verifies active `Enrollment` record exists.
5. **`ValidationPipe`:** Validates and transforms request body/query DTOs using `class-validator`.
6. **Service Layer:** Executes domain rules, business validations (e.g. Publish Checklist), and database queries using `PrismaService` inside `prisma.$transaction` when multi-table writes occur.
7. **`TransformInterceptor`:** Wraps successful controller output into standard envelope `{ success: true, data, meta }`.
8. **`HttpExceptionFilter`:** Catches all exceptions, logs internal stack traces, and formats error response `{ success: false, statusCode, message, error, timestamp, path }`.

---

## 4. Redis Caching & Invalidation Architecture
- **Cache-Aside Pattern:** When `GET /courses` is called with query params (page, category, level), a cache key `courses:list:<hash>` is checked in Redis.
  - **Hit:** Return cached JSON immediately.
  - **Miss:** Query PostgreSQL via `PrismaService`, store result in Redis with a 15-minute TTL, and return.
- **Cache Invalidation:** Any mutation to course structure (`PATCH /courses/:id`, `PATCH /courses/:id/publish`, `PATCH /courses/:id/archive`, chapter/lesson changes) triggers atomic invalidation of key pattern `courses:list:*`.

---

## 5. RabbitMQ Asynchronous Event Strategy
- **Decoupled Workflows:** Requests that trigger user notifications do not block the HTTP lifecycle.
  - **Enrollment Flow:** `POST /courses/:courseId/enroll` creates `Enrollment` in PostgreSQL $\rightarrow$ publishes event `course.enrolled` to RabbitMQ exchange `eduhub.events` $\rightarrow$ HTTP 201 response sent immediately $\rightarrow$ Worker consumes event and writes `Notification` row.
  - **Quiz Submission Flow:** `POST /quizzes/:quizId/attempts` grades attempt $\rightarrow$ writes `QuizAttempt` $\rightarrow$ publishes `quiz.submitted` event $\rightarrow$ Worker creates achievement/result notification.
  - **Course Completion Flow:** When the final lesson is completed and `Enrollment.Status` transitions to `COMPLETED` $\rightarrow$ publishes `course.completed` event $\rightarrow$ Worker writes graduation/completion notification.
- **Reliability:**
  - Manual message acknowledgement (`channel.ack()`).
  - Retry policy with exponential backoff on transient errors.
  - Dead-Letter Queue (DLQ: `eduhub.dlq`) to capture unprocessable messages for developer inspection.

---

## 6. Synchronous vs Asynchronous Decision Matrix

| Operation | Mode | Rationale |
| :--- | :--- | :--- |
| **Login & Register** | Synchronous | User requires immediate credentials verification and JWT token return. |
| **Course & Lesson CRUD** | Synchronous | Teacher needs immediate confirmation and ID for UI state. |
| **Course Publish Validation** | Synchronous | Immediate feedback on publish-ready checklist status (200 OK or 422 Unprocessable). |
| **Course Enrollment** | Sync Write + Async Event | Student needs immediate access confirmation; welcome notification is sent asynchronously. |
| **Quiz Evaluation** | Synchronous | Student expects instant score and pass/fail feedback on submission. |
| **Course 100% Completion** | Sync State + Async Event | Progress updated immediately; graduation notification dispatched asynchronously. |
| **Notification Persistence** | Asynchronous | Handled by RabbitMQ worker to prevent slowing down primary domain transactions. |
| **Catalog Discovery** | Sync + Redis Read | Cached read optimization for high-traffic discovery endpoints. |

---

## 7. Resilience & Fault Tolerance
- **Redis Outage:** Cache failures are caught gracefully; API automatically falls back to PostgreSQL querying.
- **RabbitMQ Outage:** Critical database transactions complete successfully; failed message dispatches are logged and buffered.
- **PostgreSQL Outage:** API returns clean 500 error with standard error envelope while logging error details for diagnostics.

---

## 8. Query Optimization & Anti-N+1 Strategy

To guarantee low latency (< 15ms) and eliminate N+1 query bottlenecks:
1. **Heartbeat Aggregation (`PUT /lessons/:id/progress`):**
   - Fetches lesson, video, quiz, and chapter course ID in **one** `findUnique` query via Prisma `include`.
   - Checks overall course completion by batching count queries inside `prisma.$transaction([ countTotalLessons, countCompletedLessons ])` in a single network round-trip.
2. **Teacher Reporting (`GET /courses/:id/students`):**
   - Executes a single SQL aggregate query utilizing `COUNT(DISTINCT lp.lesson_id) FILTER (WHERE lp.is_completed = true)` joined on `enrollments` and `users`.
   - Avoids issuing separate progress queries per student, retrieving $N$ student records with real-time calculated percentages in $O(1)$ query complexity.
