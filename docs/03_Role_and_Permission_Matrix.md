# 03 — Role & Permission Matrix
**Pre-Coding Documentation**  
*Project:* EduHub | *Version:* 1.3 | *Status:* Refined before coding

---

## 1. Authorization Model
EduHub uses two separate concepts: **role permission** (RBAC) and **resource ownership**.
- A **role** answers: *'Is this type of user allowed to perform this action?'*
- **Ownership** answers: *'Is the resource involved actually owned by this user?'*

A request is authorized only when **both** applicable checks pass.  
*Example:* A Teacher is allowed to update courses, but Teacher A may update only courses where `course.teacherId == user.id`. Teacher A cannot update Teacher B's course. An Admin has system-wide permissions and bypasses teacher ownership restrictions.

## 2. Roles & Account Lifecycle

| Role | Provisioning | Description |
| :--- | :--- | :--- |
| **Student** | Self-registration via `POST /auth/register`. | Learner who enrolls in published courses, watches lessons, completes quizzes, and tracks personal progress. |
| **Teacher** | Provisioned by Admin (`POST /users` or `PATCH /users/:id/role`). | Content creator who creates and manages owned courses, chapters, lessons, videos, resources, and quizzes, and inspects enrolled student progress. |
| **Admin** | Initial seed / Operational administrator. | Platform administrator with full access to manage users, roles, categories, course lifecycle, and system notifications. |

## 3. Permission Legend & Matrix
*Legend:*  
- **C** = Create, **R** = Read, **U** = Update, **D** = Delete/Archive, **P** = Publish/Status management.  
- **Own** = Resource must belong to the current authenticated user (`teacherId == user.id` or `studentId == user.id`).  
- **Enrolled** = Student must possess an active enrollment record for the course.  
- **All** = Unrestricted permission for that role.  
- **No** = Action is prohibited.

| Resource / Action | Student | Teacher | Admin | Notes / Endpoints |
| :--- | :---: | :---: | :---: | :--- |
| **Profile: R/U** | Own | Own | Own | `/auth/me` |
| **Users: R/U/status/role** | No | No | All | `/users`, `/users/:id/*` |
| **Categories: R** | All | All | All | Public & authenticated course browsing |
| **Categories: C/U** | No | No | All | `/categories` |
| **Categories: D (delete)** | No | No | All (if 0 courses) | Denied with 409 if courses are assigned |
| **Course: R published** | All | All | All | Public discovery `/courses` |
| **Course: R owned (all status)** | No | Own | All | `/me/courses` (includes Draft, Published, Archived) |
| **Course: C** | No | Own new | All | `/courses` |
| **Course: U** | No | Own | All | `/courses/:id` |
| **Course: Archive** | No | Own | All | `/courses/:id/archive` |
| **Course: Publish/Unpublish** | No | Own | All | `/courses/:id/publish`, `/courses/:id/unpublish` |
| **Chapter: C/U/D/batch-reorder** | No | Own | All | `/courses/:courseId/chapters`, `/chapters/:id`, `/courses/:courseId/chapters/reorder` |
| **Lesson: C/U/D/batch-reorder** | No | Own | All | `/chapters/:chapterId/lessons`, `/lessons/:id`, `/chapters/:chapterId/lessons/reorder` |
| **Lesson: R content** | Enrolled | Own | All | `/lessons/:id` (masks `isCorrect` for Student) |
| **Video: manage** | No | Own | All | `/lessons/:id/video` (mandatory before publish) |
| **Resources: manage** | No | Own | All | `/lessons/:id/resources`, `/resources/:id` |
| **Resources: R / download** | Enrolled | Own | All | `/lessons/:id` |
| **Enrollment: C (enroll)** | Self | No | Operational view | `/courses/:courseId/enroll` (Student only) |
| **Enrollment: R** | Own | Own course | All | `/me/enrollments`, `/courses/:id/students` |
| **Lesson progress: R/U** | Enrolled Own | No | System/Admin | `/lessons/:id/progress` |
| **Course progress: R** | Enrolled Own | Own course | All | `/me/progress/courses/:courseId`, `/courses/:id/progress` |
| **Quiz: C/U/D** | No | Own | All | `/lessons/:id/quiz`, `/quizzes/:id` |
| **Quiz questions/answers: C/U/D** | No | Own | All | `/quizzes/:quizId/questions`, `/questions/:id` |
| **Quiz attempt: C (submit)** | Enrolled | No | No | `/quizzes/:quizId/attempts` (unlimited attempts) |
| **Quiz result: R** | Own | Own course | All | `/quizzes/:quizId/attempts`, `/courses/:id/quiz-results` |
| **Notifications: R/U read** | Own | Own | Own | `/notifications`, `/notifications/:id/read` |
| **System notification: C** | No | No | All | `/notifications/system` |

## 4. Resource Ownership Rules

| Resource | Ownership Resolution Rule |
| :--- | :--- |
| **Course** | Teacher owns the course if `Course.TeacherId == RequestUser.Id`. |
| **Chapter** | Ownership is resolved via `Chapter.Course` → `Course.TeacherId == RequestUser.Id`. |
| **Lesson** | Ownership is resolved via `Lesson.Chapter` → `Chapter.Course` → `Course.TeacherId == RequestUser.Id`. |
| **Video** | Ownership is resolved via `Video.Lesson` → `Lesson.Chapter` → `Course.TeacherId == RequestUser.Id`. |
| **Resource** | Ownership is resolved via `Resource.Lesson` → `Lesson.Chapter` → `Course.TeacherId == RequestUser.Id`. |
| **Quiz** | Ownership is resolved via `Quiz.Lesson` → `Lesson.Chapter` → `Course.TeacherId == RequestUser.Id`. |
| **Question / Answer** | Ownership is resolved via `Question.Quiz` → `Quiz.Lesson` → `Lesson.Chapter` → `Course.TeacherId == RequestUser.Id`. |
| **Enrollment** | Student owns their enrollment (`Enrollment.StudentId == RequestUser.Id`); Teacher owns read access for owned courses. |
| **LessonProgress** | Student owns their progress records (`LessonProgress.StudentId == RequestUser.Id`). |
| **QuizAttempt** | Student owns their attempt submissions (`QuizAttempt.StudentId == RequestUser.Id`). |
| **Notification** | User owns their notifications (`Notification.UserId == RequestUser.Id`). |

## 5. Authorization Decision Examples
- `Student` requests `PATCH /courses/10` → **Deny (403 Forbidden)** (Student lacks course update role permission).
- `Teacher A` requests `PATCH /courses/10` where `course.teacherId = Teacher A` → **Allow (200 OK)**.
- `Teacher A` requests `PATCH /courses/20` where `course.teacherId = Teacher B` → **Deny (403 Forbidden)** (Ownership check fails).
- `Teacher A` requests `GET /me/courses` → **Allow (200 OK)** (Returns only courses where `teacherId = Teacher A`).
- `Admin` requests `PATCH /courses/20` → **Allow (200 OK)** (Admin role bypasses ownership constraint).
- `Student` requests `POST /quizzes/5/attempts` → **Allow (201 Created)** only if Student is actively enrolled in the course containing Quiz 5.
- `Teacher A` requests `GET /courses/20/students` where Course 20 is owned by Teacher B → **Deny (403 Forbidden)**.
- `Admin` requests `DELETE /categories/3` where Category 3 has 5 courses attached → **Deny (409 Conflict)** (Business constraint: category must have 0 courses).

## 6. Implementation Guard Pattern
1. **`JwtAuthGuard`**: Authenticates JWT token and attaches `req.user` (`{ id, email, role }`).
2. **`RolesGuard`**: Checks `@Roles(Role.TEACHER, Role.ADMIN)` against `req.user.role`.
3. **`CourseOwnershipGuard`** / **Resource Ownership Interceptor**: Checks resource ID parameter, fetches entity via `PrismaService`, and verifies `entity.teacherId === req.user.id` (skipped if `req.user.role === Role.ADMIN`).
4. **`EnrollmentGuard`**: For student learning endpoints, verifies `prisma.enrollment.findUnique({ where: { studentId_courseId: { studentId: req.user.id, courseId } } })` exists and has `status === 'ACTIVE'`.
