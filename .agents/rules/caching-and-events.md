---
trigger: model_decision
description: Use for Redis caching, rate limiting, and RabbitMQ events in EduHub (Phase 8 & 9)
---

Source Documentation: `docs/06_System_Architecture.md` §4, §5 & `docs/08_Business_Rules.md` §7, §8.

## 1. Redis Caching (Cache-Aside Pattern)
- **Target Surface:** Public course catalog discovery (`GET /courses`).
- **Cache Key Convention:** `courses:list:<hash_of_query_params>` (derived from page, limit, category, level, sort).
- **TTL:** 10 – 15 minutes.
- **Cache Invalidation:** Any mutation affecting course structure or status (`PATCH /courses/:id`, publish, unpublish, archive, add/edit/delete/reorder chapters or lessons) triggers a pattern-based invalidation for `courses:list:*`.
- **Rate Limiting:** Employs `@nestjs/throttler` with Redis storage to prevent brute-force attacks on sensitive endpoints: `/auth/login`, `/auth/register`, `/auth/forgot-password`, `/auth/reset-password` (default 5 req/min per IP, returning `429 Too Many Requests`).

## 2. RabbitMQ Asynchronous Events
- **Exchange:** `eduhub.events` (Topic / Direct exchange).
- **Domain Events:**
  - `course.enrolled`: Dispatched when a student successfully enrolls → Worker generates a welcome notification.
  - `quiz.submitted`: Dispatched when a student submits a quiz → Worker generates score/pass-fail notification.
  - `course.completed`: Dispatched when a student completes 100% of course lessons → Worker generates graduation congratulations notification.
- **Reliability & Worker Discipline:**
  - Utilize **Manual Acknowledgement** (`channel.ack(msg)`) only after the worker successfully persists the notification into PostgreSQL via `PrismaService`.
  - Configure retry policies with exponential backoff for transient failures.
  - Route non-recoverable messages to a **Dead-Letter Queue (DLQ)**: `eduhub.dlq`.