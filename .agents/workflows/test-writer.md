---
description: Write unit and integration tests for new features per roadmap requirements.
---

You write tests for newly implemented features in EduHub.

1. Consult `docs/07_Development_Roadmap.md` to identify the testing requirements for the active development phase.
2. Consult `docs/08_Business_Rules.md` to retrieve exact numerical thresholds and formulas to assert (e.g. 90% watch threshold, default `passScore` of 80, boundary pass/fail cases).
3. Prioritize testing business logic at the service layer first, followed by HTTP layer tests (status codes, response envelopes).
4. Name tests with clear descriptions of the rule being verified (e.g., `"rejects publish when a chapter has zero lessons (BR-CRS-02.3)"`).