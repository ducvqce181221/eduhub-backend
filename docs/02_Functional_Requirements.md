# 02 — Functional Requirements
**Pre-Coding Documentation**  
*Project:* EduHub | *Version:* 1.4 | *Status:* Refined before coding

---

## 1. Authentication & Account

| ID | Feature | Description | Roles |
| :--- | :--- | :--- | :--- |
| **FR-A01** | Register | Create a student account with validated credentials. Public registration is restricted to `Student` role. | Public |
| **FR-A02** | Login | Authenticate user via email/password and issue access/refresh tokens. | All |
| **FR-A03** | Refresh token | Issue a new access token using a valid refresh token stored in cookie/body. | All |
| **FR-A04** | Logout | Invalidate the active session/refresh token. | All |
| **FR-A05** | Forgot password | Initiate a password reset request via email token. | Public |
| **FR-A06** | Reset password | Set a new password using a valid reset token. | Public |
| **FR-A07** | Change password | Change current password after authentication. | All |
| **FR-A08** | View profile | Retrieve current authenticated user profile. | All |
| **FR-A09** | Update profile | Update allowed personal information (full name, avatar URL). | All |
| **FR-A10** | Avatar | Update/remove user profile avatar URL. | All |
| **FR-A11** | Bot Challenge | Validate Cloudflare Turnstile token on public auth requests (`login`, `register`, `forgot-password`, `reset-password`). | Public |

## 2. User Management (Admin)

| ID | Feature | Description | Roles |
| :--- | :--- | :--- | :--- |
| **FR-U01** | List users | Paginated user list with role and status filters. | Admin |
| **FR-U02** | Search/filter users | Search users by name/email and filter by role/status. | Admin |
| **FR-U03** | View user | View detailed user account and profile information. | Admin |
| **FR-U04** | Create user | Create an account for operational purposes (e.g. Teacher, Admin). | Admin |
| **FR-U05** | Update user | Update administrative fields (email, name, active status). | Admin |
| **FR-U06** | Change role | Assign or modify user role (`STUDENT`, `TEACHER`, `ADMIN`). | Admin |
| **FR-U07** | Enable/disable user | Toggle active status to prevent or permit authentication. | Admin |

## 3. Category Management

| ID | Feature | Description | Roles |
| :--- | :--- | :--- | :--- |
| **FR-C01** | List categories | View active categories for course discovery and creation. | All authenticated / Public |
| **FR-C02** | Create category | Create a new course category with unique name and slug. | Admin |
| **FR-C03** | Update category | Edit category title, description, or active status. | Admin |
| **FR-C04** | Disable category | Set `IsActive = false`. Existing courses retain category; blocked from new course creation. | Admin |
| **FR-C05** | Delete category | Hard delete allowed only if 0 courses reference this category (`courseCount === 0`). Otherwise rejected with `409 Conflict`. | Admin |

## 4. Course / Chapter / Lesson Management

| ID | Feature | Description | Roles |
| :--- | :--- | :--- | :--- |
| **FR-CO01** | Create course | Create a draft course (`Status = 'DRAFT'`) with auto-generated unique slug (`slugify(title)-nanoid(6)`). | Teacher, Admin |
| **FR-CO02** | View course | View course details according to publication status and enrollment access rules. | All |
| **FR-CO03** | Update course | Edit course metadata (title, description, level, thumbnail, category); Teacher restricted to owned courses. | Teacher(owner), Admin |
| **FR-CO04** | Archive course | Archive a course (`Status = 'ARCHIVED'`). Allowed from `DRAFT` or `PUBLISHED`. Preserves historical records. | Teacher(owner), Admin |
| **FR-CO05** | Publish course | Publish a course after validating the **Publish-Ready Checklist** ($\ge 1$ chapter, each chapter $\ge 1$ lesson, every lesson has valid video). | Teacher(owner), Admin |
| **FR-CO06** | Unpublish course | Revert a published course back to `DRAFT` status. | Teacher(owner), Admin |
| **FR-CO07** | Search/filter/sort | Search published courses by keyword; filter by category/level; paginate results. | All |
| **FR-CO08** | Create chapter | Add a chapter to an owned/managed course (auto-assigns sequential `order`). | Teacher(owner), Admin |
| **FR-CO09** | Update/delete/batch-reorder chapter | Manage chapter title, description, and atomic batch reordering. Deleting last chapter of published course is blocked. | Teacher(owner), Admin |
| **FR-CO10** | Create lesson | Add a lesson to a chapter (auto-assigns sequential `order`). Allows initial creation without video in draft mode. | Teacher(owner), Admin |
| **FR-CO11** | Update/delete/batch-reorder lesson | Manage lesson title, description, and atomic batch reordering. Deleting last lesson of chapter in published course is blocked. | Teacher(owner), Admin |
| **FR-CO12** | Manage video | Attach or update video metadata (URL, duration in seconds) for a lesson. Mandatory before publishing. | Teacher(owner), Admin |
| **FR-CO13** | Manage resources | Add/update/delete zero or many downloadable/reference resources per lesson (integer `fileSize`). | Teacher(owner), Admin |
| **FR-CO14** | View owned courses | View all courses owned by current teacher across all statuses (`DRAFT`, `PUBLISHED`, `ARCHIVED`). | Teacher, Admin |
| **FR-CO15** | Guest video preview | Allow unauthenticated guests to stream the introductory video lesson of a published course (`isPreview = true`). All other lesson videos/resources remain strictly masked. | Public |

## 5. Enrollment & Progress

| ID | Feature | Description | Roles |
| :--- | :--- | :--- | :--- |
| **FR-E01** | Enroll | Student enrolls in a published course. Self-unenrollment is out of scope for MVP. | Student |
| **FR-E02** | View my courses | List courses the authenticated student is currently enrolled in. | Student |
| **FR-E03** | View course students | View enrolled learners and real-time dynamically computed progress metrics for an owned course. | Teacher(owner), Admin |
| **FR-E04** | Track lesson progress | Record watched seconds incrementally via client heartbeats (clamped to video duration). | Enrolled Student |
| **FR-E05** | Auto-complete lesson | Automatically mark lesson completed when watched duration reaches $\ge 90\%$ of video duration AND quiz (if attached) is passed. | System |
| **FR-E06** | View course progress | Calculate course completion percentage dynamically from `lesson_progress` records with divide-by-zero defense. | Enrolled Student, Teacher(owner), Admin |

## 6. Quiz & Assessment

| ID | Feature | Description | Roles |
| :--- | :--- | :--- | :--- |
| **FR-Q01** | Create quiz | Create zero or one quiz per lesson with title, description, and `PassScore` percentage ($0 - 100\%$). | Teacher(owner), Admin |
| **FR-Q02** | Manage questions | Create/update/delete single-choice questions with explicit `Points` ($\ge 1$). | Teacher(owner), Admin |
| **FR-Q03** | Manage answers | Create/update answer choices (minimum 2 choices per question, exactly 1 marked `IsCorrect = true`). | Teacher(owner), Admin |
| **FR-Q04** | Take quiz | Submit quiz attempt with selected answers. Unlimited attempts allowed. | Enrolled Student |
| **FR-Q05** | Calculate score | Backend evaluates answers atomically: correct answer awards full question points, incorrect awards 0. Score percentage = $(EarnedPoints / TotalPoints) * 100$ (stored as Float). | System |
| **FR-Q06** | View result | View immediate score, pass/fail status, and attempt review for own submission. Mask `isCorrect` before submission. | Student |
| **FR-Q07** | View learner results | View aggregated quiz attempt results and passing rates for owned course. | Teacher(owner), Admin |
| **FR-Q08** | Pass rule | Attempt passes if `AttemptScorePercentage >= Quiz.PassScore`. At least one passing attempt satisfies lesson completion requirement. | System |

## 7. Notifications & Async Processing

| ID | Feature | Description | Roles |
| :--- | :--- | :--- | :--- |
| **FR-N01** | Create notification event | Publish domain events (`course.enrolled`, `quiz.submitted`, `course.completed`) to RabbitMQ. | System |
| **FR-N02** | Process event | Consume RabbitMQ messages asynchronously to persist user notifications (`NotificationType` enum). | System |
| **FR-N03** | View notifications | View paginated list of authenticated user's notifications. | All authenticated |
| **FR-N04** | Mark read | Mark a specific notification as read. | All authenticated |
| **FR-N05** | Mark all read | Mark all notifications of current user as read. | All authenticated |
| **FR-N06** | System notification | Dispatch platform-wide announcement notifications. | Admin |

## 8. Media & File Storage

| ID | Feature | Description | Roles |
| :--- | :--- | :--- | :--- |
| **FR-M01** | Upload Image | Upload and auto-optimize image assets (avatars, course thumbnails) via Cloudinary SDK. | All authenticated / Teacher / Admin |
| **FR-M02** | Presigned S3 Upload URL | Generate temporary S3 Presigned PUT URLs for direct client upload of lesson videos and downloadable resources to Cloudflare R2. | Teacher(owner), Admin |
| **FR-M03** | Media validation | Validate file mime-types and size limits on upload and presigned URL generation (e.g. max 5MB for images, max 200MB for lesson videos, max 50MB for resources). | System |
| **FR-M04** | Presigned preview URL | Generate temporary S3 Presigned GET URLs for uploaded video/resource preview without altering storage or requiring re-upload. | Teacher(owner), Admin |

## 9. Banners & Promotion (Homepage Carousel)

| ID | Feature | Description | Roles |
| :--- | :--- | :--- | :--- |
| **FR-B01** | List active banners | Fetch active promotional banners ordered by `order ASC` for homepage 3:1 banner carousel. Cached in Redis. | Public |
| **FR-B02** | Manage banners | CRUD operations for promotional banners (`title`, `imageUrl`, `linkUrl`, `order`, `isActive`). | Admin |
| **FR-B03** | Batch reorder banners | Batch update banner display sequence (`{ orders: [{ id, order }] }`) atomically with cache invalidation. | Admin |
| **FR-B04** | Banner dimension validation | UI validates uploaded banner images strictly against 3:1 aspect ratio (recommended 1200x400 px) with live preview and replacement. | Admin |

## 10. Non-functional / Technical Requirements
- Validate all incoming request DTOs using `class-validator` and `ValidationPipe` with whitelist and transform enabled.
- Wrap all responses in standard envelopes (`{ success: true, data, meta }` for success; `{ success: false, statusCode, message, error, timestamp, path }` for errors).
- Protect authenticated endpoints with JWT access tokens; verify refresh tokens via secure rotation.
- Enforce authorization strictly on backend using RBAC and Resource Ownership Guards via `PrismaService`.
- Execute multi-table updates (e.g. quiz grading, course publishing, batch reordering, enrollment creation) inside PostgreSQL transactions using Prisma Interactive Transactions (`prisma.$transaction`).
- Implement Redis cache for course discovery with explicit TTL and invalidate cache upon course update/archive/publish.
- Configure RabbitMQ manual ACKs, retry strategy, and Dead-Letter Queue (DLQ) for asynchronous workers.
- Offload video and large resource file uploads directly to Cloudflare R2 using backend-minted S3 Presigned URLs; offload avatar and thumbnail image processing to Cloudinary CDN.
- Document every REST endpoint with Swagger annotations and accurate schema models.
- Implement unit and integration tests per phase (Auth, RBAC, Progress, Quiz, RabbitMQ) before moving to subsequent phases.

## 11. Deployment / Operational Requirements
- Environment configuration via `.env` files supporting local development, managed cloud, and Oracle Cloud Free VPS.
- Health-check endpoint (`GET /api/v1/health`) for liveness/readiness probes (PostgreSQL, Redis, RabbitMQ connectivity).
- Never commit secrets or sensitive credentials into source control.
- Structured logging for HTTP requests, asynchronous worker jobs, and operational errors.
- Document deployment, backup, and rollback procedures.
