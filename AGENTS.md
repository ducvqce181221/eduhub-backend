## Project

EduHub — LMS portfolio/learning project platform. Students register, enroll in courses, view lessons (video + quiz), and track progress. Teachers create and manage courses. Administrators govern the platform. For comprehensive context and scope, consult `docs/01_Project_Overview.md`.

## Tech Stack

- Backend: NestJS + TypeScript
- Package manager: pnpm
- ORM / DB: Prisma ORM v7 + PostgreSQL (`@prisma/adapter-pg` driver adapter)
- Cache / Rate-limit: Redis
- Async events: RabbitMQ
- Frontend: Next.js + TypeScript
- API docs: Swagger/OpenAPI at `/api/docs`
- Local infra: Docker Compose

## Source Documentation (Read relevant sections before coding)

- `docs/01_Project_Overview.md` — context, scope, user flow
- `docs/02_Functional_Requirements.md` — functional requirements by module
- `docs/03_Role_and_Permission_Matrix.md` — RBAC + ownership rules
- `docs/04_Database_Design.md` — complete `schema.prisma` (15 models, 5 enums), `prisma.config.ts`, and driver adapter architecture
- `docs/05_API_Design.md` — endpoints, response envelope, status codes
- `docs/06_System_Architecture.md` — sync/async flows, Redis/RabbitMQ
- `docs/07_Development_Roadmap.md` — 14-phase progression and completion criteria
- `docs/08_Business_Rules.md` — **single source of truth** for all validations, state machines, and scoring formulas. When other documents are ambiguous, this document takes precedence.

## Mandatory Rules

1. Wrap all responses in the standard envelope: `{ success, data, meta? }` (success) / `{ success: false, statusCode, message, error, timestamp, path }` (error) — see `05_API_Design.md` §1.1.
2. Authorization must always be enforced on the backend via Guards (`JwtAuthGuard` → `RolesGuard` → Ownership/Enrollment Guard) — never trust the frontend.
3. All multi-table write operations / check-then-act sequences must run inside `prisma.$transaction`: course publishing, quiz submissions, batch reordering, enrollment, progress updates, category deletion, and curriculum floor deletion (see `04_Database_Design.md` §7).
4. Business logic must strictly match `08_Business_Rules.md` by Rule ID (BR-XXX-NN) — never invent numerical thresholds or formulas when the documentation explicitly states them.
5. Write unit and integration tests within the active development phase (per `07_Development_Roadmap.md`), never deferring them to the final phase.
6. The `order` field (Chapter/Lesson) is always calculated as `max + 1` at the service layer; User/Category relations use `onDelete: Restrict` — see details in the `db-schema` skill.
7. Prisma 7 Architecture: Datasource URL is managed via `prisma.config.ts`. Client generation targets `src/generated/prisma`. Client instantiation uses Driver Adapter `@prisma/adapter-pg` (`new PrismaPg(...)`) wrapped inside `PrismaService` via `src/lib/prisma.ts`.

## Common Commands

```bash
docker compose up -d        # start local Postgres/Redis/RabbitMQ
pnpm run dev                # start NestJS dev server in watch mode (tsx watch src/main.ts)
pnpm run db:migrate         # run migrations (or: pnpm prisma migrate dev)
pnpm run db:generate        # generate Prisma Client to src/generated/prisma
pnpm run db:seed            # seed database using tsx via prisma.config.ts
pnpm prisma studio          # inspect database in Prisma Studio
pnpm run build              # compile app with tsc
pnpm run start              # run compiled server from dist/main.js
pnpm test                   # run unit tests
pnpm run test:e2e           # run integration/e2e tests
```

## Expected Module Structure (NestJS)

```
src/
  auth/  users/  categories/  courses/  chapters/  lessons/
  videos/  resources/  quizzes/  enrollments/  progress/  notifications/
  common/             # filters, interceptors, guards, decorators
    cache/            # Redis client wrapper & caching service
    events/           # RabbitMQ producer / consumer / event definitions
  prisma/             # PrismaModule, PrismaService
```

Each module contains: `*.module.ts`, `*.controller.ts`, `*.service.ts`, `dto/create-*.dto.ts`, `dto/update-*.dto.ts`. Never place business logic inside Controllers.
