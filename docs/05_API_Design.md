# 05 — API Design
**Pre-Coding Documentation**  
*Project:* EduHub | *Version:* 1.5 | *Status:* Refined before coding

> **Source of truth.** This is the canonical API contract — it's generated/verified against
> the actual Swagger output (`/api/docs-json`) as endpoints are built. `eduhub-frontend`
> keeps a mirrored copy at `docs/05_API_Design.md`. When this file changes, update the
> frontend copy in the same PR/session, or better: point the frontend's codegen
> (`openapi-typescript` or similar) at `/api/docs-json` so its types regenerate automatically
> instead of relying on a hand-synced markdown copy.

---

## 1. API Principles & Standard Envelopes
- **Base path:** `/api/v1`
- RESTful resource-oriented URLs.
- Bearer JWT authentication for protected endpoints.
- Strict DTO validation with NestJS `ValidationPipe` (`whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`).
- Swagger/OpenAPI documentation auto-generated at `/api/docs`.

### 1.1 Standard Response Formats

**Success Response Envelope (Single Resource):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "title": "Course Title"
  }
}
```

**Success Response Envelope (Paginated Collection):**
```json
{
  "success": true,
  "data": [ ... ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 45,
    "totalPages": 5
  }
}
```

**Error Response Envelope:**
```json
{
  "success": false,
  "statusCode": 400,
  "message": ["passScore must not be greater than 100"],
  "error": "Bad Request",
  "timestamp": "2026-08-26T08:30:00.000Z",
  "path": "/api/v1/lessons/uuid/quiz"
}
```

---

## 2. Endpoints

### 2.1 Authentication & Profile

| Method | Endpoint | Purpose | Auth / Role |
| :--- | :--- | :--- | :--- |
| `POST` | `/auth/register` | Register student account (Student only) | Public |
| `POST` | `/auth/login` | Login with email/password; returns access & refresh tokens | Public |
| `POST` | `/auth/refresh` | Issue new access token via refresh token | Refresh Token |
| `POST` | `/auth/logout` | Invalidate active refresh token | JWT Authenticated |
| `POST` | `/auth/forgot-password` | Request password reset token | Public |
| `POST` | `/auth/reset-password` | Set new password using reset token | Public |
| `POST` | `/auth/change-password` | Change current password | JWT Authenticated |
| `GET` | `/auth/me` | Retrieve authenticated user profile | JWT Authenticated |
| `PATCH`| `/auth/me` | Update personal profile information | JWT Authenticated |

### 2.2 User Management (Admin)

| Method | Endpoint | Purpose | Auth / Role |
| :--- | :--- | :--- | :--- |
| `GET` | `/users` | Paginated user list with role/status filters | Admin |
| `GET` | `/users/:id` | View detailed user account info | Admin |
| `POST` | `/users` | Create operational user (e.g. Teacher, Admin) | Admin |
| `PATCH`| `/users/:id` | Update user administrative details | Admin |
| `PATCH`| `/users/:id/status` | Enable/disable user account | Admin |
| `PATCH`| `/users/:id/role` | Change user role (`STUDENT`, `TEACHER`, `ADMIN`) | Admin |

### 2.3 Category Management

| Method | Endpoint | Purpose | Auth / Role |
| :--- | :--- | :--- | :--- |
| `GET` | `/categories` | List active categories for course discovery/creation | Public / Authenticated |
| `POST` | `/categories` | Create new course category | Admin |
| `PATCH`| `/categories/:id` | Update category details or toggle active status | Admin |
| `DELETE`| `/categories/:id` | Hard delete category (Allowed only if 0 courses reference it; otherwise returns `409 Conflict`) | Admin |

### 2.4 Course Management

| Method | Endpoint | Purpose | Auth / Role |
| :--- | :--- | :--- | :--- |
| `GET` | `/courses` | Search, filter, paginate published courses (Cached in Redis) | Public / Authenticated |
| `GET` | `/me/courses` | List all courses owned by current teacher across all statuses (`DRAFT`, `PUBLISHED`, `ARCHIVED`) | Teacher / Admin |
| `POST` | `/courses` | Create a new draft course (auto-generates unique slug: `slugify(title)-nanoid(6)`; `description` optional) | Teacher / Admin |
| `GET` | `/courses/:id` | View course details (drafts restricted to owner/admin) | Public / Authenticated |
| `PATCH`| `/courses/:id` | Update course metadata | Owner / Admin |
| `PATCH`| `/courses/:id/archive`| Archive course (Status $\rightarrow$ `ARCHIVED`; allowed from `DRAFT` or `PUBLISHED`) | Owner / Admin |
| `PATCH`| `/courses/:id/publish`| Publish course (Validates Publish-Ready Checklist; returns `422` if incomplete) | Owner / Admin |
| `PATCH`| `/courses/:id/unpublish`| Revert published course to `DRAFT` | Owner / Admin |
| `GET` | `/courses/:id/students`| View enrolled students and real-time computed progress metrics | Owner / Admin |
| `GET` | `/courses/:id/progress`| View aggregate student progress metrics for course | Owner / Admin |

### 2.5 Chapters & Lessons

| Method | Endpoint | Purpose | Auth / Role |
| :--- | :--- | :--- | :--- |
| `POST` | `/courses/:courseId/chapters` | Create chapter in course (auto-assigns sequential `order` if omitted) | Owner / Admin |
| `PATCH`| `/chapters/:id` | Update chapter title/description | Owner / Admin |
| `DELETE`| `/chapters/:id` | Delete chapter and cascading lessons (Blocked with `400` if last chapter of published course) | Owner / Admin |
| `PATCH`| `/courses/:courseId/chapters/reorder` | Batch reorder chapters in course (`{ orders: [{ id, order }] }`) | Owner / Admin |
| `POST` | `/chapters/:chapterId/lessons` | Create lesson (auto-assigns sequential `order` if omitted; optional initial `video`) | Owner / Admin |
| `GET` | `/lessons/:id` | View lesson details & content (Masks `isCorrect` for Students) | Enrolled Student / Owner / Admin |
| `PATCH`| `/lessons/:id` | Update lesson title/description | Owner / Admin |
| `DELETE`| `/lessons/:id` | Delete lesson, video, resources, and quiz (Blocked with `400` if last lesson of chapter in published course) | Owner / Admin |
| `PATCH`| `/chapters/:chapterId/lessons/reorder` | Batch reorder lessons in chapter (`{ orders: [{ id, order }] }`) | Owner / Admin |
| `PUT` | `/lessons/:id/video` | Upsert required video metadata (`VideoUrl`, `DurationSeconds`) | Owner / Admin |
| `POST` | `/lessons/:id/resources` | Add downloadable resource | Owner / Admin |
| `PATCH`| `/resources/:id` | Update resource name/URL | Owner / Admin |
| `DELETE`| `/resources/:id` | Delete resource | Owner / Admin |

### 2.6 Enrollment & Progress

| Method | Endpoint | Purpose | Auth / Role |
| :--- | :--- | :--- | :--- |
| `POST` | `/courses/:courseId/enroll` | Enroll current student in published course | Student |
| `GET` | `/me/enrollments` | List enrolled courses of current student | Student |
| `GET` | `/me/progress/courses/:courseId`| Get overall course progress percentage, completed lesson counts, and completed IDs | Student |
| `GET` | `/lessons/:lessonId/progress` | Get current student's progress for specific lesson | Student / Owner / Admin |
| `PUT` | `/lessons/:lessonId/progress` | Update `WatchedSeconds` heartbeat (clamps to duration, auto-evaluates `isCompleted = true` if $\ge 90\%$; triggers `course.completed` if 100%) | Enrolled Student |

### 2.7 Quiz & Assessment

| Method | Endpoint | Purpose | Auth / Role |
| :--- | :--- | :--- | :--- |
| `POST` | `/lessons/:lessonId/quiz` | Create quiz for lesson (with `PassScore` percentage $0 - 100\%$) | Owner / Admin |
| `PATCH`| `/quizzes/:id` | Update quiz title, description, `PassScore` | Owner / Admin |
| `DELETE`| `/quizzes/:id` | Delete quiz and its questions/answers | Owner / Admin |
| `POST` | `/quizzes/:quizId/questions` | Add single-choice question with `Points` ($\ge 1$) and answers | Owner / Admin |
| `PATCH`| `/questions/:id` | Update question content, points, or answers | Owner / Admin |
| `DELETE`| `/questions/:id` | Delete question | Owner / Admin |
| `POST` | `/quizzes/:quizId/attempts` | Submit quiz attempt (Atomic transaction: grades submission, returns score & pass status, triggers lesson completion if video was $\ge 90\%$; triggers `course.completed` if 100%) | Enrolled Student |
| `GET` | `/quizzes/:quizId/attempts` | View list of previous attempt summaries for current student | Enrolled Student |
| `GET` | `/courses/:courseId/quiz-results`| View student quiz results for owned course | Owner / Admin |

### 2.8 Notifications

| Method | Endpoint | Purpose | Auth / Role |
| :--- | :--- | :--- | :--- |
| `GET` | `/notifications` | Paginated list of current user's notifications | JWT Authenticated |
| `PATCH`| `/notifications/:id/read` | Mark specific notification as read | Owner |
| `PATCH`| `/notifications/read-all` | Mark all unread notifications as read | Owner |
| `POST` | `/notifications/system` | Dispatch system-wide broadcast notification | Admin |

### 2.9 Media & Uploads (Hybrid: Cloudinary + Cloudflare R2)

| Method | Endpoint | Purpose | Auth / Role |
| :--- | :--- | :--- | :--- |
| `POST` | `/upload/image` | Upload image (Avatar / Thumbnail) to Cloudinary; returns optimized URLs | JWT Authenticated |
| `POST` | `/upload/presigned-url` | Mint S3 Presigned PUT URL for client direct upload to Cloudflare R2 (`videos`, `resources`) | Teacher / Admin |

---

## 3. Standard HTTP Status Codes
- **200 OK:** Successful GET, PATCH, PUT.
- **201 Created:** Successful resource creation (POST).
- **204 No Content:** Successful deletion without body.
- **400 Bad Request:** DTO validation failures, malformed requests, or attempting to delete the last chapter/lesson of a published course.
- **401 Unauthorized:** Missing, expired, or invalid JWT access token.
- **403 Forbidden:** Valid JWT but insufficient role or failed ownership check.
- **404 Not Found:** Requested entity does not exist.
- **409 Conflict:** Unique constraint violation (duplicate email, duplicate enrollment) or category deletion with attached courses.
- **422 Unprocessable Entity:** Business rule violation (e.g. Course Publish Checklist failure).
- **500 Internal Server Error:** Unhandled server error (details logged, generic message returned).

---

## 4. Payload Samples

### 4.1 Batch Curriculum Reorder Payload (`PATCH /courses/:courseId/chapters/reorder`)

**Request:**
```json
{
  "orders": [
    { "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6", "order": 1 },
    { "id": "7ca85f64-5717-4562-b3fc-2c963f66afa7", "order": 2 },
    { "id": "8da85f64-5717-4562-b3fc-2c963f66afa8", "order": 3 }
  ]
}
```

**Response (`200 OK`):**
```json
{
  "success": true,
  "data": {
    "message": "Chapters reordered successfully"
  }
}
```

### 4.2 Atomic Quiz Submission Payload & Result Sample (`POST /quizzes/:quizId/attempts`)

**Request:**
```json
{
  "answers": [
    { "questionId": "uuid-q1", "selectedAnswerId": "uuid-a2" },
    { "questionId": "uuid-q2", "selectedAnswerId": "uuid-a4" }
  ]
}
```

**Response (`201 Created`):**
```json
{
  "success": true,
  "data": {
    "attemptId": "uuid-attempt-1",
    "quizId": "uuid-quiz-1",
    "earnedPoints": 18,
    "totalPoints": 20,
    "score": 90.0,
    "passScore": 80,
    "isPassed": true,
    "isLessonCompleted": true,
    "submittedAt": "2026-08-26T08:35:00.000Z"
  }
}
```

### 4.3 Quiz Attempt History Sample (`GET /quizzes/:quizId/attempts`)

**Response (`200 OK`):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-attempt-1",
      "score": 90.0,
      "passScore": 80,
      "isPassed": true,
      "earnedPoints": 18,
      "totalPoints": 20,
      "startedAt": "2026-08-26T08:30:00.000Z",
      "submittedAt": "2026-08-26T08:35:00.000Z"
    }
  ]
}
```

### 4.4 Enrolled Students with Dynamic Progress Sample (`GET /courses/:courseId/students`)

**Response (`200 OK`):**
```json
{
  "success": true,
  "data": [
    {
      "studentId": "uuid-student-1",
      "fullName": "John Doe",
      "email": "student1@example.com",
      "enrolledAt": "2026-08-20T10:00:00.000Z",
      "completedLessons": 9,
      "totalLessons": 10,
      "progressPercentage": 90.0,
      "isCompleted": false
    }
  ]
}
```

### 4.5 Presigned Upload URL Sample (`POST /upload/presigned-url`)

**Request:**
```json
{
  "fileName": "intro-to-nestjs.mp4",
  "fileType": "video/mp4",
  "folder": "videos"
}
```

**Response (`201 Created`):**
```json
{
  "success": true,
  "data": {
    "uploadUrl": "https://<account-id>.r2.cloudflarestorage.com/eduhub/videos/uuid-intro-to-nestjs.mp4?X-Amz-Algorithm=...",
    "fileUrl": "https://pub-<hash>.r2.dev/videos/uuid-intro-to-nestjs.mp4",
    "key": "videos/uuid-intro-to-nestjs.mp4",
    "expiresIn": 3600
  }
}
```

