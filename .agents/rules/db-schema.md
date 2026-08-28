---
trigger: model_decision
description: Use for Prisma queries, migrations, or database schema modifications (models, fields, enums, relations) in EduHub
---

`docs/04_Database_Design.md` contains the complete `schema.prisma` (15 models, 5 enums) + cardinality table + Transaction Boundaries. Review prior to:
- Writing Prisma queries with joins, nested includes, or aggregations
- Adding or modifying fields, models, or enums
- Writing new migrations

Critical considerations (high risk of subtle bugs if ignored):
- `Chapter.order` / `Lesson.order` are not auto-incrementing — the service must compute `max(existing order in scope) + 1` prior to insertion.
- **Question.order Quirk:** `Question.order` currently has `@default(1)` without a per-quiz unique constraint — resolve explicitly in Phase 7 implementation: reuse the `max + 1` pattern like Chapter/Lesson rather than leaving order default 1 for all questions.
- `User → Course/Enrollment/LessonProgress/QuizAttempt` relations: enforce `onDelete: Restrict` to preserve historical records.
- `Category → Course` relation: enforce `onDelete: Restrict` — aligning with the rule "cannot delete category with existing course references".
- All dependent lesson relations (`Lesson → Video/Resource/Quiz/LessonProgress`, `Quiz → Question/Answer/QuizAttempt/QuizAttemptAnswer`) use `onDelete: Cascade` to cleanly purge data when removing a lesson.
- `Course.description` and `Course.thumbnailUrl` are nullable in schema for rapid draft creation — mandatory validation is enforced via the Publish Checklist (`08_Business_Rules.md`).