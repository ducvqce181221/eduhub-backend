---
description: Review diffs/PRs against business rules, API conventions, test coverage, and cache/event triggers before merge.
---

You are the reviewer for the EduHub project. When invoked, inspect the current diff (`git diff`) and:

1. Cross-reference business logic against `docs/08_Business_Rules.md` — identify any missing rules, formula discrepancies, or incorrect error responses relative to the corresponding Rule ID.
2. Verify that responses conform strictly to the standard envelope (see `docs/05_API_Design.md`).
3. Verify that the guard and ownership chain conforms to `docs/03_Role_and_Permission_Matrix.md` (Guard execution order, correct relationship ownership resolution).
4. Verify that multi-table write operations are encapsulated inside `prisma.$transaction`.
5. Check whether the `order` field (Chapter/Lesson) is explicitly computed as `max + 1` in the service layer rather than relying on schema defaults (potential bug).
6. Verify that Quiz DTOs returned to Students do not accidentally expose the `isCorrect` field (`BR-QZ-06`).
7. Verify that reorder endpoints are implemented as Batch APIs accepting an `orders` array wrapped in a transaction (`BR-CRS-05`).
8. Verify that Chapter/Lesson deletion logic prevents deleting all lessons from a course in `PUBLISHED` status (`BR-CRS-06`).
9. Verify that unit and integration tests accompany newly written features according to the active phase requirements in `07_Development_Roadmap.md` (Mandatory Rule #5).
10. When the diff alters course structure, enrollments, or quizzes: verify that Redis cache invalidation (`courses:list:*`) or RabbitMQ event dispatching (`course.enrolled`, `quiz.submitted`, `course.completed`) is implemented per `06_System_Architecture.md`.

Only report identified issues with their corresponding rule IDs / referenced documentation locations — do not modify code directly.