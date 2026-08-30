# 01 — Project Overview
**Pre-Coding Documentation**  
*Project:* EduHub | *Version:* 1.2 | *Status:* Refined before coding

> **Repo scope note:** This is the **`eduhub-backend`** repo (NestJS API). It owns everything
> in §6–§9 below except the Next.js client itself. The UI is built in the sibling
> **`eduhub-frontend`** repo, which keeps its own copy of this same overview plus
> frontend-specific docs (`06_Frontend_Architecture.md`, `07_Development_Roadmap.md`,
> `08_UI_Requirements.md`). Anything DB/Prisma/Redis/RabbitMQ-related (`04`, `06`, `08`)
> lives **only** here — the frontend never needs those internals.

---

## 1. Project Name
**EduHub**

EduHub is a web-based learning management platform designed as a portfolio and learning project. It models a streamlined online-course experience: teachers create courses composed of chapters and lessons; each lesson contains a required video (validated before publication) and may include resources and a quiz; students enroll, learn, complete quizzes, and track progress; administrators manage the platform.

## 2. Project Purpose
The primary purpose of EduHub is to provide a realistic domain for learning and demonstrating modern backend engineering. The project is intentionally built from a new codebase so that the developer can learn NestJS, TypeScript, PostgreSQL, Prisma ORM, Redis, RabbitMQ, JWT authentication, REST APIs, Swagger, and related engineering practices through one coherent system.

- Build a complete full-stack application rather than isolated technology demos.
- Use real business flows to understand why backend technologies are needed.
- Create a portfolio project that directly maps to common Backend Developer job requirements.
- Keep the initial scope manageable and add advanced technologies only after the core system is stable.

## 3. Problem Statement
Online learning platforms need more than simple CRUD. They must organize hierarchical learning content, enforce access rules, track progress, evaluate quizzes, provide timely notifications, and remain responsive as data and traffic grow. EduHub addresses these needs with a deliberately simplified but realistic learning workflow.

- **Learner perspective:** Discover a course, enroll, consume lessons, access optional learning materials, complete quizzes (unlimited attempts, passing threshold), and see meaningful progress.
- **Teacher perspective:** Create and maintain structured educational content, manage course lifecycle (Draft, Published, Archived), manage owned courses via a dedicated teacher dashboard, and monitor learner progress.
- **Administrator perspective:** Maintain users, provision teacher accounts, manage categories safely with referential constraints, oversee courses, and execute platform-level operations.

## 4. Target Users

| User | Provisioning & Role | Primary Needs |
| :--- | :--- | :--- |
| **Student** | Self-registered via public registration (`POST /auth/register`). | Discover courses, enroll, watch lessons (90% completion threshold), access resources, take quizzes, track progress, receive notifications. |
| **Teacher** | Provisioned by Admin via operational creation (`POST /users`) or role upgrade (`PATCH /users/:id/role`). No public teacher self-registration. | Create and manage owned courses (draft, publish, archive), manage chapters, lessons, videos, resources, quizzes, view own course list via `/me/courses`, and monitor learner progress. |
| **Admin** | Initial seed / system administrator. | Manage users and roles/statuses, manage categories (with delete protection), review and archive courses platform-wide, manage system notifications. |

## 5. Main Goals
1. Deliver a working end-to-end learning platform with Next.js frontend and NestJS backend.
2. Use PostgreSQL as the single primary relational database and Prisma ORM for type-safe schema modeling, migrations, and data persistence.
3. Implement secure JWT-based authentication and role/resource-based authorization (RBAC + Ownership).
4. Use Redis for caching course discovery, rate limiting sensitive endpoints, and temporary auth data.
5. Use RabbitMQ for asynchronous event-driven processing and notification workflows.
6. Provide well-structured RESTful APIs with consistent response envelopes and Swagger documentation.
7. Practice validation, error handling, database transactions, pagination, filtering, logging, and continuous test-driven verification across all development phases.
8. Create clear documentation and business rules so architectural decisions can be explained in interviews.

## 6. Scope

### 6.1 Core Functional Scope
- **Authentication & Account Management:** Register (Student only), login, refresh token, logout, forgot/reset password (public flow), change password, profile management.
- **User Management (Admin):** List, search, filter, view, create operational user (e.g. Teacher), update status, assign role (Student/Teacher).
- **Category Management:** Course category organization with deletion safeguards (blocked if courses are attached).
- **Course Management:** Enforced with ownership rules; course lifecycle states (`DRAFT`, `PUBLISHED`, `ARCHIVED`). Teacher view (`GET /me/courses`) to inspect all owned courses.
- **Chapter & Lesson Management:** Hierarchical content structure with reordering support.
- **Lesson Video Metadata:** 1:0..1 during draft creation; strictly 1:1 validated before a course or lesson can be published.
- **Lesson Resources:** Optional, 0..N downloadable/external resources per lesson.
- **Lesson Quiz:** Optional, 0..1 quiz per lesson with single-choice questions, point-based grading, percentage pass score, and unlimited student attempts.
- **Enrollment & Learning Progress:** Student course enrollment; lesson progress tracking based on 90% watch threshold and quiz pass requirement; derived course completion percentage.
- **Quiz Attempts & Score Calculation:** Atomic server-side grading and immediate result feedback.
- **Notifications:** Asynchronous notification workflows via RabbitMQ (`course.enrolled`, `quiz.submitted`, system announcements).
- **Course Discovery:** Search, category filtering, level filtering, sorting, pagination, and Redis caching for published courses.
- **REST API Documentation:** Interactive docs with Swagger / OpenAPI.

### 6.2 Technical Scope
- Frontend: Next.js + TypeScript
- Backend: NestJS + TypeScript
- Database: PostgreSQL + Prisma ORM v7
- Cache & Temporary State: Redis
- Message Broker: RabbitMQ
- Image Processing & CDN: Cloudinary (User Avatar, Course Thumbnail)
- Video & File Object Storage: Cloudflare R2 via `@aws-sdk/client-s3` (Lesson Videos, Downloadable Resources)
- Local Infrastructure: Docker Compose
- Auth: JWT authentication (Access Token + Refresh Token)
- *Optional later extensions:* CASL, Google OAuth2, GraphQL, OpenAI, email provider integration.

## 7. Out of Scope
- Real payment, subscription, marketplace, or instructor payout systems.
- Student self-unenrollment and refund flows (Enrollment status is retained in schema for admin/future use).
- Live video streaming, on-premise video transcoding pipelines, or DRM (Video and document storage uses Cloudflare R2 S3-compatible object storage with direct Presigned URLs; Images use Cloudinary CDN).
- Real-time chat, forums, social feeds, and live classes.
- Microservices decomposition of every domain.
- Multiple primary databases (MongoDB/MySQL intentionally excluded).
- Advanced recommendation/search infrastructure (Elasticsearch).
- Multi-region production infrastructure.
- Mobile applications.

## 8. Technology Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend** | Next.js + TypeScript | Web UI, routing, authentication UX, student & teacher dashboards, learning player. |
| **Backend** | NestJS + TypeScript | REST API, business logic, authentication, authorization, validation, response envelope, event orchestration. |
| **Database** | PostgreSQL | Primary relational data store. |
| **ORM** | Prisma ORM v7 | Centralized `schema.prisma`, automated SQL migrations, type-safe client, relations, and transactions. |
| **Cache / Temporary State** | Redis | Caching discovery data, rate limiting, temporary authentication/session data. |
| **Message Broker** | RabbitMQ | Asynchronous domain events and background notification processing. |
| **Image Storage & CDN** | Cloudinary | Auto-optimization, resizing, cropping, and CDN hosting for avatars and thumbnails. |
| **Video & Object Storage** | Cloudflare R2 | S3-compatible storage with 0$ egress fees for lesson videos and downloadable resources. |
| **API Documentation** | Swagger / OpenAPI | Interactive API documentation. |
| **Infrastructure** | Docker Compose | Local PostgreSQL, Redis, RabbitMQ and related services. |

## 9. High-Level Architecture
EduHub uses a modular full-stack architecture. Next.js is the presentation layer. NestJS is the single backend application and owns business rules. PostgreSQL is the source of truth for relational data accessed via Prisma ORM. Redis provides fast temporary storage and caching. RabbitMQ decouples asynchronous work such as notification processing from the request-response path. Media is managed via a hybrid storage model: Cloudinary for optimized image transformations and Cloudflare R2 for zero-egress video and file object storage via S3-compatible Presigned URLs.

- **Flow:** `Next.js` → `NestJS REST API (Global Interceptor & Filter)` → `PrismaService` → `PostgreSQL`.
- **Integrations:** NestJS communicates with Redis (cache/rate limit/session), RabbitMQ (asynchronous events), Cloudinary (image uploads), and Cloudflare R2 (presigned URL generation for client direct uploads). Workers consume queued events and persist state back through application services.

## 10. Main User Flows

### 10.1 Student Learning Flow
1. Student registers (`POST /auth/register`) or logs in (`POST /auth/login`).
2. Student browses and filters published courses (`GET /courses`).
3. Student opens a course detail page (`GET /courses/:id`).
4. Student enrolls in the course (`POST /courses/:courseId/enroll`).
5. Student opens a lesson (`GET /lessons/:id`).
6. Student watches video; frontend periodically syncs watch progress (`PUT /lessons/:id/progress`).
7. When watched duration reaches $\ge 90\%$ of total video duration, watch requirement is fulfilled.
8. If the lesson has a quiz, the student submits an attempt (`POST /quizzes/:quizId/attempts`).
9. Backend calculates the score atomically via a Prisma transaction; if `Score >= PassScore`, quiz requirement is fulfilled.
10. When both video ($\ge 90\%$) and quiz (passed, if present) are satisfied, lesson is marked completed.
11. Completed lessons update overall course progress (`GET /me/progress/courses/:courseId`).
12. Student receives relevant async notifications via RabbitMQ consumer.

### 10.2 Teacher Content Flow
1. Teacher logs in (credentials provisioned by Admin).
2. Teacher views dashboard of owned courses across all statuses (`GET /me/courses`).
3. Teacher creates a new draft course (`POST /courses`).
4. Teacher adds chapters (`POST /courses/:courseId/chapters`) and lessons (`POST /chapters/:chapterId/lessons`).
5. Teacher attaches required video metadata (`PUT /lessons/:id/video`) and optional resources (`POST /lessons/:id/resources`).
6. Teacher optionally creates a quiz for a lesson (`POST /lessons/:lessonId/quiz`) and adds questions/answers.
7. Teacher publishes the course (`PATCH /courses/:id/publish`). Backend verifies the **Publish-Ready Checklist** (metadata complete, $\ge 1$ chapter, each chapter $\ge 1$ lesson, every lesson has valid video).
8. Published course becomes visible in discovery; teacher views enrolled learners and progress (`GET /courses/:id/students`, `GET /courses/:id/progress`).
9. Teacher can archive the course (`PATCH /courses/:id/archive`) when retirement is needed.

### 10.3 Admin Flow
1. Admin logs in.
2. Admin manages users, creates Teacher accounts, and updates account roles/statuses.
3. Admin manages categories (creates, updates, disables, or deletes if zero courses attached).
4. Admin reviews platform courses and can archive courses if necessary.
5. Admin dispatches platform-level system notifications.

## 11. Design Principles
- Learn one concept at a time and apply it to a real feature.
- Prefer a simple, clean architecture that can be explained clearly in technical interviews.
- Do not add technology solely to tick a job-description keyword.
- Keep business rules in the backend; the frontend should not be trusted for authorization or score calculation.
- Write unit and integration tests per phase rather than delaying quality assurance to the end.
- Adhere strictly to the domain specifications in `08_Business_Rules.md`.

## 12. Deployment Strategy

### Option 1 — Managed Free-Tier Cloud
- **Next.js:** Vercel or similar managed frontend hosting.
- **NestJS API:** Render free web service.
- **PostgreSQL:** Supabase free tier candidate.
- **Redis & RabbitMQ:** Compatible managed/free infrastructure or hosted on Oracle Cloud.
- *Goal:* Fast public demo with low operational overhead.

### Option 2 — Oracle Cloud Free (Preferred DevOps Path)
- Run stack on Oracle Cloud Free compute instance.
- Use Docker/Compose, Linux, Nginx/reverse proxy, HTTPS, firewall/network rules, secrets, logs, health checks, backups, and CI/CD.
- *Goal:* Learn infrastructure underneath managed deployment.
