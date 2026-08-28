---
trigger: model_decision
description: Use for EduHub test writing, testing discipline, and mandatory phase-specific coverage.
---

Per `07_Development_Roadmap.md`: Every phase includes a dedicated **Test** section, written **within** that phase — never deferred to the end of the project.

Mandatory test coverage (consult Roadmap Phase Test sections for exact criteria):
- **RBAC + Ownership (Phase 4):** Students blocked from administrative endpoints; Teacher A cannot modify Teacher B's courses; Admin bypasses ownership.
- **Publish Checklist & Floor Protection (Phase 5):** Rejection with `422` when any of the 5 checklist criteria fail; passes when all met; rejection with `400` when deleting the last lesson/chapter of a course in `PUBLISHED` state; batch reordering tested without unique index conflicts.
- **Progress & Aggregation (Phase 6):** Heartbeat progress clamping to `durationSeconds`; lesson uncompleted at 89%, completed at ≥90%; single-query SQL aggregation for teacher learner reports; defensive division-by-zero test for courses with zero lessons.
- **Quiz Scoring & Security (Phase 7):** 100% correct, partial score, 0% score; boundary pass/fail (e.g. 79% fail / 80% pass); security test for DTO masking: Students cannot see `isCorrect`, Teachers/Admins can.
- **Redis & Rate Limiting (Phase 8):** Cache hit/miss; cache invalidation upon course update; `429 Too Many Requests` returned when exceeding rate limits on auth routes.
- **RabbitMQ (Phase 9):** Simulated publishing of `course.enrolled`, `quiz.submitted`, `course.completed`; retry policy and DLQ routing verification when consumers fail.

Prioritize service layer tests (business logic & transactional integrity) before testing HTTP transport layers.