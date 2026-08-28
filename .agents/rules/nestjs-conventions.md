---
trigger: model_decision
description: Use for implementing EduHub NestJS modules, controllers, services, guards, DTOs, coding style, and layering.
---

- Per resource: `module.ts`, `controller.ts`, `service.ts`, `dto/create-*.dto.ts`, `dto/update-*.dto.ts` located in dedicated directories under `src/`.
- Infrastructure modules: `src/common/cache/` (Redis), `src/common/events/` (RabbitMQ), `src/prisma/`.
- Fixed Guard execution pipeline order: `JwtAuthGuard` → `RolesGuard` → Ownership/Enrollment Guard (see `03_Role_and_Permission_Matrix.md` §6).
- Ownership checks must always query through `PrismaService`, resolving across the exact relation chain defined in `03_Role_and_Permission_Matrix.md` §4 (e.g. Lesson → Chapter → `Course.teacherId`). Admins always bypass ownership checks.
- Never write business logic inside Controllers — Controllers exclusively receive requests, delegate to Services, and return responses.
- **Interactive Transactions:** Wrap multi-table mutations within `prisma.$transaction(async (tx) => {...})`. Always use `tx` inside the callback instead of `this.prisma` to stay within the transaction context.
- **Batch Reordering:** Design reorder endpoints as batch operations on parent resources (`PATCH /courses/:id/chapters/reorder` and `PATCH /chapters/:id/lessons/reorder` accepting an `orders: [{ id, order }]` array).
- **Anti-N+1 Strategy:** During video heartbeat updates or progress recalculations, bundle metadata queries via Prisma `include` and batch counts in transactions. Teacher student reports must execute as a single aggregated SQL query.