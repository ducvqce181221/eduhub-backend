---
trigger: model_decision
description: Use when implementing, reviewing, or debugging validation rules, state transitions, scoring formulas, or calculations in EduHub
---

Before implementing any service-layer logic related to:
- Course state machine (`DRAFT` ↔ `PUBLISHED` → `ARCHIVED`, `DRAFT` → `ARCHIVED` discard) and Publish-Ready Checklist (`BR-CRS-02`)
- Published curriculum floor constraint (`BR-CRS-06`): Prohibit deleting the final chapter/lesson of a course in `PUBLISHED` state
- Slug generation (`BR-CRS-01`): `slug = slugify(title) + '-' + nanoid(6)`
- Quiz scoring (`BR-QZ-05`), pass/fail threshold (`BR-QZ-02`), DTO masking hiding `isCorrect` from Students (`BR-QZ-06`)
- Lesson completion (`BR-PRG-02`): ≥90% watch threshold (`BR-PRG-01` clamped) + quiz pass if a quiz exists
- Learner progress & Teacher reporting (`BR-PRG-03`, `BR-PRG-04`): Real-time dynamic computation from `lesson_progress` via SQL aggregation, defensive division-by-zero handling
- Category deletion safeguard (`BR-CAT-02`) / active-category check (`BR-CAT-03`)
- Curriculum expansion handling (`BR-ENR-04`): `Enrollment.Status` strictly remains `COMPLETED` when new lessons are added to an already completed course.

→ Read `docs/08_Business_Rules.md` completely first, cross-referencing the exact Rule ID (BR-XXX-NN). Annotate implementation code with the rule ID in comments where appropriate.

Never extrapolate numerical thresholds or formulas without clear documentation — pause and ask rather than assuming defaults.