# EduHub Backend API

[![Live API](https://img.shields.io/badge/API-Live%20on%20Render-46E3B7?style=flat-square&logo=render)](https://eduhub-backend-d6vk.onrender.com/api/v1/health)
[![Swagger Docs](https://img.shields.io/badge/Swagger-Interactive%20Docs-85EA2D?style=flat-square&logo=swagger)](https://eduhub-backend-d6vk.onrender.com/api/docs)
[![Frontend Client](https://img.shields.io/badge/Frontend-Live%20on%20Vercel-000000?style=flat-square&logo=vercel)](https://eduhub-frontend-xi.vercel.app)
[![NestJS](https://img.shields.io/badge/Framework-NestJS%2011-E0234E?style=flat-square&logo=nestjs)](https://nestjs.com/)
[![Prisma ORM](https://img.shields.io/badge/ORM-Prisma%207-2D3748?style=flat-square&logo=prisma)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL%2017-4169E1?style=flat-square&logo=postgresql)](https://www.postgresql.org/)

The enterprise-grade RESTful API powering the **EduHub** Learning Management System. Built with **NestJS 11**, **TypeScript**, **Prisma ORM v7**, and a cloud-ready micro-architecture supporting caching, event-driven processing, and secure media streaming.

---

## 🌐 Live Deployments

- **Backend API Base URL:** [https://eduhub-backend-d6vk.onrender.com/api/v1](https://eduhub-backend-d6vk.onrender.com/api/v1)
- **Interactive Swagger UI:** [https://eduhub-backend-d6vk.onrender.com/api/docs](https://eduhub-backend-d6vk.onrender.com/api/docs)
- **OpenAPI JSON Schema:** [https://eduhub-backend-d6vk.onrender.com/api/docs-json](https://eduhub-backend-d6vk.onrender.com/api/docs-json)
- **Health Check Endpoint:** [https://eduhub-backend-d6vk.onrender.com/api/v1/health](https://eduhub-backend-d6vk.onrender.com/api/v1/health)
- **Frontend Web Application:** [https://eduhub-frontend-xi.vercel.app](https://eduhub-frontend-xi.vercel.app)

---

## 🚀 Tech Stack & System Architecture

| Component | Technology | Description |
| :--- | :--- | :--- |
| **Core Framework** | NestJS 11 + TypeScript | Modular architecture with strict dependency injection, validation pipes, and filters |
| **Database & ORM** | PostgreSQL 17 + Prisma 7 | `@prisma/adapter-pg` driver adapter, migrations, connection pooling, transactions |
| **Cache & Rate Limit** | Redis 7 (`ioredis`) | Cache-Aside pattern for course discovery (`TTL: 15m`), throttling for sensitive routes |
| **Async Message Broker** | RabbitMQ 3 (`amqplib`) | Event publisher & consumer worker with Dead-Letter Queue (DLQ) support |
| **Object Storage** | Cloudflare R2 (`@aws-sdk/client-s3`) | S3-compatible storage with direct binary presigned URLs for lesson videos & resources |
| **Media CDN** | Cloudinary | High-performance image storage & transformations for course thumbnails and avatars |
| **Authentication** | JWT + Passport + Google OAuth2 | Dual-token auth (Access + Refresh tokens with cookie-parser), CASL RBAC |
| **Bot Protection** | Cloudflare Turnstile | Server-side siteverify verification on public auth endpoints |
| **Testing Engine** | Vitest 4 + Supertest | Blazing fast unit and integration testing suite across all domains |

---

## ✨ Key Capabilities & Business Logic

- **Role-Based Access Control (RBAC):** Hierarchical permissions (`ADMIN`, `TEACHER`, `STUDENT`) and granular resource ownership guards (`Course.teacherId === user.id`).
- **Publish-Ready Checklist Engine:** Courses cannot be published unless they have $\ge 1$ chapter, $\ge 1$ lesson, and valid videos for all lessons (strict state machine: `DRAFT` $\to$ `PUBLISHED` $\to$ `ARCHIVED`).
- **Learning Progress & Heartbeat Sync:** Client heartbeat synchronization with duration clamping; auto-completes lessons when watched $\ge 90\%$ and associated quiz is passed.
- **Server-Side Quiz Evaluation:** Atomic quiz submissions inside interactive Prisma transactions with score calculation and answer masking (`isCorrect` is never leaked before submission).
- **Event-Driven Asynchronous Processing:** Dispatches domain events (`course.enrolled`, `quiz.submitted`, `course.completed`) through RabbitMQ with an async notification consumer.
- **Media Asset Library & Deduplication:** Teacher asset library supporting SHA-256 hash deduplication, external URLs, and secure presigned video streaming preview.
- **Promotional Banner Carousel:** Admin-managed home banners with strict 3:1 aspect ratio enforcement and Redis caching.
- **Strict Response Envelopes:** Standardized response wrapper `{ success, data, meta? }` and global `HttpExceptionFilter`.

---

## 📁 Project Structure

```
src/
├── auth/           # Authentication, JWT, Google OAuth2, Turnstile verification
├── banners/        # Promo banner management, order ranking, Redis cache
├── casl/           # CASL ability factory for fine-grained authorization
├── categories/     # Category CRUD with referential-constraint protection
├── chapters/       # Chapter management, batch reordering in transactions
├── common/         # Global filters, interceptors, decorators, guards
│   ├── cache/      # Redis client wrapper & caching service
│   ├── events/     # RabbitMQ producer, consumers, and event payloads
│   ├── filters/    # Standardized HttpExceptionFilter
│   └── guards/     # JwtAuthGuard, RolesGuard, OwnershipGuard
├── courses/        # Course lifecycle (Draft/Publish/Archive), discovery, caching
├── enrollments/    # Course enrollment logic, access permissions
├── health/         # Healthcheck service for DB, Redis, and RabbitMQ
├── lessons/        # Lesson management, video association, resources
├── media-assets/   # Centralized asset library, SHA-256 hash deduplication
├── notifications/  # Notification query, read state, async worker
├── prisma/         # PrismaService module
├── progress/       # 90% watch duration calculation, heartbeat sync
├── quizzes/        # Quizzes, questions, atomic scoring & attempts
├── upload/         # Cloudflare R2 Presigned URLs, Cloudinary upload
└── users/          # Admin user management, profile endpoints
```

---

## 📋 Prerequisites

Before running locally, ensure you have the following installed:

- **Node.js:** `v20.x` or later (LTS recommended)
- **Package Manager:** `pnpm` (`v10.x` or `v11.x`)
- **Container Runtime:** [Docker Desktop](https://www.docker.com/products/docker-desktop/) (for local PostgreSQL, Redis, and RabbitMQ)

---

## 🛠️ Local Development Setup

### 1. Clone the repository

```bash
git clone https://github.com/ducvqce181221/eduhub-backend.git
cd eduhub-backend
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Start local infrastructure services

Use the provided `docker-compose.yml` to spin up PostgreSQL (port `5433`), Redis (port `6379`), and RabbitMQ (ports `5672` & `15672`):

```bash
docker compose up -d
```

Verify containers are running:
```bash
docker compose ps
```

### 4. Configure environment variables

Copy `.env.example` to `.env` and configure your settings:

```bash
cp .env.example .env
```

Key local settings in `.env`:
```env
PORT=5000
NODE_ENV=development
APP_URL=http://localhost:5000
FRONTEND_URL=http://localhost:3000
ENABLE_SWAGGER=true

# Database (matches docker-compose.yml on port 5433)
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/eduhub_db?schema=public

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# RabbitMQ
RABBITMQ_URL=amqp://guest:guest@localhost:5672

# JWT Secrets
JWT_ACCESS_SECRET=your-access-secret-key-at-least-32-chars
JWT_REFRESH_SECRET=your-refresh-secret-key-at-least-32-chars
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Bot Defense (Set to false for local testing if no key configured)
ENABLE_TURNSTILE=false
```

### 5. Initialize Database & Seed

Generate Prisma Client, execute database migrations, and seed initial test data:

```bash
# Generate Prisma Client to src/generated/prisma
pnpm run db:generate

# Apply migrations
pnpm run db:migrate

# Seed full database (users, categories, courses, curriculum, quizzes)
pnpm run db:seed
```

### 6. Start the development server

```bash
pnpm run dev
```

The API will be available at:
- **API Base:** [http://localhost:5000/api/v1](http://localhost:5000/api/v1)
- **Swagger Documentation:** [http://localhost:5000/api/docs](http://localhost:5000/api/docs)
- **Health Check:** [http://localhost:5000/api/v1/health](http://localhost:5000/api/v1/health)

---

## 🔑 Demo Credentials

All seeded accounts share the default password: **`Password123!`**

| Role | Email | Password | Primary Capabilities |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@eduhub.dev` | `Password123!` | Full user/role management, category controls, platform banners, broadcast notifications |
| **Teacher** | `teacher1@eduhub.dev` | `Password123!` | Create & manage owned courses, upload videos/resources, build quizzes, view enrolled students |
| **Teacher** | `teacher2@eduhub.dev` | `Password123!` | Secondary instructor account for testing ownership boundaries |
| **Student** | `student1@eduhub.dev` | `Password123!` | Browse catalog, enroll in courses, stream videos, submit quizzes, view progress |
| **Student** | `student2@eduhub.dev` | `Password123!` | Additional student account for progress & attempt verification |

---

## 🧪 Testing

The test suite contains **38 comprehensive test specifications** covering unit logic, business rules (BR-XXX-NN), relational integrity, and integration flows:

```bash
# Run all unit and integration tests (requires docker services running)
pnpm test

# Run tests in watch mode
pnpm run test:watch
```

---

## 📜 Available NPM Scripts

| Command | Action |
| :--- | :--- |
| `pnpm run dev` | Start NestJS development server with file watch mode via `tsx` |
| `pnpm run build` | Compile TypeScript code into `dist/` |
| `pnpm run start` | Run compiled production build with `node --import tsx dist/main.js` |
| `pnpm run db:generate` | Generate Prisma client into `src/generated/prisma` |
| `pnpm run db:migrate` | Create and apply migration in development mode |
| `pnpm run db:migrate:deploy` | Apply migrations to production database (PaaS / CI/CD) |
| `pnpm run db:seed` | Seed database with full set of test users, courses, and content |
| `pnpm test` | Run automated test suite via Vitest |

---

## ☁️ Production Deployment Guide (Render / Cloud PaaS)

When deploying to PaaS environments (such as Render or Railway) with managed PostgreSQL (e.g., Neon, Supabase) and managed Redis (e.g., Upstash):

1. **Build Command:**
   ```bash
   pnpm install && pnpm run db:generate && pnpm run build
   ```

2. **Pre-Deploy / Migration Command:**
   ```bash
   pnpm run db:migrate:deploy
   ```

3. **Start Command:**
   ```bash
   pnpm run start
   ```

4. **Required Production Environment Variables:**
   - `NODE_ENV=production`
   - `PORT=5000` (or dynamically supplied by the platform)
   - `FRONTEND_URL=https://eduhub-frontend-xi.vercel.app`
   - `DATABASE_URL=postgresql://user:pass@ep-host.region.neon.tech/eduhub?sslmode=require`
   - `REDIS_URL=rediss://default:password@region.upstash.io:6379` (TLS enabled)
   - `RABBITMQ_URL=amqps://user:pass@region.cloudamqp.com/vhost`
   - `ENABLE_SWAGGER=true` (Set to `true` to keep `/api/docs` accessible in production)
   - `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`
   - `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
   - `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_DOMAIN`
   - `TURNSTILE_SECRET_KEY`, `ENABLE_TURNSTILE=true`
