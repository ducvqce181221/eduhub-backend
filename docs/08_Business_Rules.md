# 08 — Business Rules Specification
**Pre-Coding Documentation**  
*Project:* EduHub | *Version:* 1.5 | *Status:* Refined before coding

---

## 1. Document Purpose
This document serves as the single authoritative source of truth for all business logic, validation rules, state machines, and calculations in EduHub. It defines the exact conditions that services, guards, and domain handlers must enforce during development and unit testing.

---

## 2. User & Authentication Rules (`BR-USR`)

| Rule ID | Rule Name | Description & Validation Logic | Error Response |
| :--- | :--- | :--- | :--- |
| **BR-USR-01** | **Public Registration Restriction** | Public registration (`POST /auth/register`) strictly sets `Role = 'STUDENT'`. Any role parameter supplied in the request body is ignored or rejected. | `400 Bad Request` |
| **BR-USR-02** | **Teacher Account Provisioning** | Accounts with `Role = 'TEACHER'` can only be created by an Admin via `POST /users` or upgraded from Student via `PATCH /users/:id/role`. | `403 Forbidden` (if non-admin) |
| **BR-USR-03** | **Active Account Authentication** | Only users with `IsActive = true` can authenticate or use refresh tokens. If an active user is disabled by Admin (`IsActive = false`), subsequent JWT validation in `JwtAuthGuard` immediately rejects the request. | `401 Unauthorized` |
| **BR-USR-04** | **Email Normalization & Uniqueness** | Email addresses must be trimmed, converted to lowercase before lookup/persistence, and must be strictly unique across all users. | `409 Conflict` (on duplicate) |
| **BR-USR-05** | **Password Complexity & Hashing** | Passwords must contain a minimum of 8 characters (at least 1 uppercase letter, 1 lowercase letter, and 1 number). Passwords must be hashed using Argon2 or bcrypt (salt rounds $\ge 10$) before saving. | `400 Bad Request` |

---

## 3. Category Management Rules (`BR-CAT`)

| Rule ID | Rule Name | Description & Validation Logic | Error Response |
| :--- | :--- | :--- | :--- |
| **BR-CAT-01** | **Category Uniqueness** | Category `Name` and `Slug` must be unique across the platform. Slug is auto-generated from Name if omitted. | `409 Conflict` |
| **BR-CAT-02** | **Category Deletion Safeguard** | A category can only be deleted if zero courses reference it (`prisma.course.count({ where: { categoryId } }) === 0`). If courses exist, deletion is blocked. Admin must either reassign courses or disable the category. | `409 Conflict` ("Category has active courses attached") |
| **BR-CAT-03** | **Disabled Category State** | Setting a category to `IsActive = false` hides it from course creation/editing dropdowns. Existing courses belonging to this category remain unchanged and continue to display. | `400 Bad Request` (if selected for new course) |

---

## 4. Course & Curriculum Content Rules (`BR-CRS`)

### 4.1 Course State Machine
A Course exists in one of three states: `DRAFT`, `PUBLISHED`, `ARCHIVED`.

```
          +-------------+
          |    DRAFT    +-----------------------------+
          +------+------+                             |
                 |                                    | (Direct Archive / Discard)
                 | (Passes Publish-Ready              |
                 |  Checklist)                        |
                 v                                    |
          +-------------+                             |
          |  PUBLISHED  +-------------------+         |
          +------+------+                   |         |
                 |                          |         |
                 | (Publish -> Archive)     |         |
                 v                          |         |
          +-------------+                   |         |
          |  ARCHIVED   | <-----------------+---------+
          +-------------+ (Terminal State in MVP: Permanent / Read-only for enrolled students)
```

| Rule ID | Rule Name | Description & Validation Logic | Error Response |
| :--- | :--- | :--- | :--- |
| **BR-CRS-01** | **Initial Course State & Unique Slug** | When created (`POST /courses`), course status is always `DRAFT`, `description` is optional (`String?`), and `PublishedAt` is `null`. `categoryId` must belong to an active category (`Category.isActive === true`). Course slug is deterministically generated to avoid collisions:$$\text{slug} = \text{slugify}(\text{title}) + \text{'-'} + \text{nanoid}(6) \quad (\text{e.g. } \texttt{lap-trinh-nestjs-k8x2d9})$$ | `400 Bad Request` |
| **BR-CRS-02** | **Course Publish-Ready Checklist** | A course can transition from `DRAFT` to `PUBLISHED` (`PATCH /courses/:id/publish`) only if all 5 criteria are met:<br>1. `title`, `description` (non-empty), `categoryId` (active category), `level`, and `thumbnailUrl` (non-empty) are present.<br>2. Course contains at least 1 Chapter ($\ge 1$).<br>3. Each Chapter contains at least 1 Lesson ($\ge 1$).<br>4. **Every Lesson strictly has an attached Video metadata record** with `durationSeconds > 0`.<br>5. Any attached Quiz contains $\ge 1$ question, and each question has $\ge 2$ answers with exactly 1 correct answer. | `422 Unprocessable Entity` (Detailed checklist error) |
| **BR-CRS-03** | **Course Ownership & Update Validation** | Only the course owner (`course.teacherId === req.user.id`) or an Admin can edit metadata, add chapters/lessons/quizzes, publish, or archive a course. Updating `categoryId` requires the targeted category to be active (`isActive === true`). | `403 Forbidden` / `400 Bad Request` |
| **BR-CRS-04** | **Archive Transitions & Terminal Policy** | A course can be archived (`PATCH /courses/:id/archive`) from either `DRAFT` (discarding draft) or `PUBLISHED` (retiring course). `ARCHIVED` is a **Terminal state in MVP** (cannot be un-archived). An archived course is hidden from public discovery and accepts no new enrollments, but remains accessible to existing enrolled students. | `400 Bad Request` |
| **BR-CRS-05** | **Curriculum Ordering & Auto-Increment** | When a Chapter or Lesson is created without specifying `order`, backend assigns `order = max(current_orders) + 1` (starting at 1). Reordering is performed via Batch APIs (`PATCH /courses/:id/chapters/reorder` and `PATCH /chapters/:id/lessons/reorder`) executed inside a `prisma.$transaction` to prevent unique constraint collisions on `@@unique([courseId, order])`. | `400 Bad Request` |
| **BR-CRS-06** | **Published Curriculum Floor Protection** | A course in `PUBLISHED` status must strictly preserve its Publish-Ready minimum invariant ($\ge 1$ Chapter, each Chapter $\ge 1$ Lesson with valid Video).<br>1. Deleting the last Chapter of a published course is blocked.<br>2. Deleting the last Lesson of a Chapter in a published course is blocked.<br>To perform structural wipeout, Teacher must unpublish the course first (`PATCH /courses/:id/unpublish`). | `400 Bad Request` ("Cannot delete the last lesson/chapter of a published course. Please unpublish first.") |

---

## 5. Lesson Video & Quiz Content Rules (`BR-LES` / `BR-QZ`)

| Rule ID | Rule Name | Description & Validation Logic | Error Response |
| :--- | :--- | :--- | :--- |
| **BR-LES-01** | **Lesson Video Metadata** | 1:0..1 during draft creation; strictly 1:1 before publication (`Video.lessonId` is `@unique`). `VideoUrl` must be a valid URI and `DurationSeconds` must be a positive integer ($> 0$). | `400 Bad Request` |
| **BR-LES-02** | **Lesson Resources** | A lesson can have 0..N optional resource items. Each resource requires a `Name`, valid `FileUrl`, `FileType`, and integer `FileSize` in bytes ($\le 2{,}147{,}483{,}647$). | `400 Bad Request` |
| **BR-QZ-01** | **Single Quiz Constraint** | A lesson can have at most one quiz attached (`Quiz.lessonId` is `@unique`). | `409 Conflict` |
| **BR-QZ-02** | **Quiz Pass Score Threshold** | `PassScore` must be an integer between $1$ and $100$ (representing percentage, e.g., $80\%$). Default is $80$. | `400 Bad Request` |
| **BR-QZ-03** | **Single-Choice Question Validation** | Each quiz question must have: $\ge 2$ answers; exactly 1 answer marked `isCorrect = true`; `points` $\ge 1$. | `400 Bad Request` |
| **BR-QZ-04** | **Unlimited Quiz Attempts & History** | Students may submit unlimited quiz attempts. Each attempt is recorded in `QuizAttempt` and `QuizAttemptAnswer`. `GET /quizzes/:id/attempts` returns an array of attempt summary objects (`[{ id, score, isPassed, earnedPoints, totalPoints, startedAt, submittedAt }]`). | N/A |
| **BR-QZ-05** | **Atomic Server-Side Grading** | The backend calculates the quiz score atomically inside `prisma.$transaction` upon submission:$$\text{Score} = \left(\frac{\sum \text{Earned Points}}{\sum \text{Total Points}}\right) \times 100$$`isPassed` is set to `true` if $\text{Score} \ge \text{Quiz.PassScore}$, else `false`. `QuizAttempt.score` is stored as a `Float`. | `400 Bad Request` |
| **BR-QZ-06** | **Quiz Answer DTO Masking (Security)** | When a Student accesses lesson details (`GET /lessons/:id`) or quiz details, the response DTO for `Answer` **strictly omits `isCorrect`**. `isCorrect` is returned only to Teachers/Admins or to Students in the immediate attempt response after submission (`POST /quizzes/:id/attempts`). | `403 Forbidden` |

---

## 6. Enrollment & Learning Progress Rules (`BR-ENR` / `BR-PRG`)

| Rule ID | Rule Name | Description & Validation Logic | Error Response |
| :--- | :--- | :--- | :--- |
| **BR-ENR-01** | **Enrollment Eligibility** | Only users with `Role = 'STUDENT'` can enroll in courses. The course must have `Status = 'PUBLISHED'`. | `400 Bad Request` |
| **BR-ENR-02** | **Duplicate Enrollment Prevention** | A student can only have one active enrollment per course (`@@unique([studentId, courseId])`). Duplicate enrollment attempt returns conflict. | `409 Conflict` |
| **BR-ENR-03** | **No Student Self-Unenrollment** | Students cannot self-unenroll. Enrollment cancellation is reserved for Admin or future operational policy. | `403 Forbidden` |
| **BR-ENR-04** | **Curriculum Expansion for Completed Enrollments** | When new lessons/chapters are added to a published course where a student previously reached 100% completion, `Enrollment.Status` **strictly remains `COMPLETED`** (preserving completion history). The progress percentage dynamically updates to reflect the new total lesson count, allowing the learner to study new lessons without stripping completed status. | N/A |
| **BR-PRG-01** | **Video Watch Threshold & Heartbeat Clamping** | `WatchedSeconds` is reported via `PUT /lessons/:id/progress`. Backend validates $\text{watchedSeconds} \ge 0$ and clamps to video duration:$$\text{ActualWatchedSeconds} = \min(\text{InputWatchedSeconds}, \text{Video.DurationSeconds})$$The video requirement is satisfied when:$$\text{ActualWatchedSeconds} \ge 0.90 \times \text{Video.DurationSeconds} \quad (\ge 90\%)$$ | `400 Bad Request` |
| **BR-PRG-02** | **Automatic Lesson Completion Evaluation** | A lesson is automatically marked `isCompleted = true` and `completedAt = now()` inside the backend service whenever:<br>1. Video watch threshold ($\ge 90\%$) is met, **AND**<br>2. If lesson has an attached quiz, student has $\ge 1$ attempt with `isPassed = true`.<br>Evaluation occurs automatically during `PUT /lessons/:id/progress` and `POST /quizzes/:id/attempts`. | `400 Bad Request` |
| **BR-PRG-03** | **Dynamic Course Progress (Single Source of Truth)** | Progress is dynamically calculated on-the-fly directly from `LessonProgress` records with defensive divide-by-zero protection:$$\text{ProgressPercentage} = \text{TotalLessons} > 0 ? \left(\frac{\text{Count of Completed Lessons}}{\text{Total Lessons in Course}}\right) \times 100 : 0$$**Completion Triggers & Event Dispatch:**<br>- When progress reaches $100\%$ (`CompletedLessons === TotalLessons` and `TotalLessons > 0`), `Enrollment.Status` is set to `COMPLETED`, `completedAt = now()`, and a `course.completed` event is dispatched to RabbitMQ.<br>- If curriculum expands or changes, progress dynamically computes to the new percentage without stale data anomalies. | N/A |
| **BR-PRG-04** | **Teacher Real-Time Progress Reporting** | Teacher progress reports (`GET /courses/:id/students` and `GET /courses/:id/progress`) do not rely on static status columns. They compute progress directly via SQL aggregation (`COUNT(DISTINCT lp.lesson_id FILTER (WHERE lp.is_completed = true)) / total_lessons`), delivering 100% real-time accuracy in a single query. | N/A |

---

## 7. Notification Rules (`BR-NTF`)

| Rule ID | Rule Name | Description & Validation Logic | Error Response |
| :--- | :--- | :--- | :--- |
| **BR-NTF-01** | **Asynchronous Event Publishing Triggers** | Domain events are published asynchronously to RabbitMQ without blocking HTTP responses:<br>- `course.enrolled`: Emitted upon new student enrollment $\rightarrow$ Worker sends welcome notification.<br>- `quiz.submitted`: Emitted upon quiz attempt submission $\rightarrow$ Worker sends score & pass/fail notification.<br>- `course.completed`: Emitted at the exact moment a student's progress reaches $100\%$ (`Enrollment.Status` transitions to `COMPLETED`) $\rightarrow$ Worker sends course completion congratulations notification. | Internal Queue |
| **BR-NTF-02** | **In-App Notification Dispatch** | Background consumer creates a `Notification` record in DB (`userId`, `type` from `NotificationType` enum, `title`, `message`, `isRead = false`) via `PrismaService`. | N/A |
| **BR-NTF-03** | **Notification Access & Read State** | Users can only view and update (`PATCH /notifications/:id/read`) their own notifications. | `403 Forbidden` |

---

## 8. Caching & Security Rules (`BR-CCH` / `BR-SEC`)

| Rule ID | Rule Name | Description & Validation Logic | Error Response |
| :--- | :--- | :--- | :--- |
| **BR-CCH-01** | **Public Course Catalog Cache** | Published course list and discovery queries are cached in Redis with a TTL (e.g. 10 minutes). | N/A |
| **BR-CCH-02** | **Cache Invalidation on Mutation** | Publishing, unpublishing, archiving, or updating course metadata invalidates related Redis discovery cache keys (`courses:list:*`). | N/A |
| **BR-SEC-01** | **Sensitive Endpoint Rate Limiting** | Authentication and credential endpoints (`/auth/login`, `/auth/register`, `/auth/forgot-password`, `/auth/reset-password`) are rate-limited via Redis Throttler (e.g., 5 requests / minute per IP). | `429 Too Many Requests` |
