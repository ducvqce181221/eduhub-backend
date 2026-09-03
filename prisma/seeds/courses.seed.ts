import { PrismaClient } from "../../src/generated/prisma/client";
import { SeededUsers } from "./users.seed";
import { SeededCategories } from "./categories.seed";

export async function seedCourses(
  prisma: PrismaClient,
  users: SeededUsers,
  categories: SeededCategories,
) {
  console.log("📚 Seeding courses, chapters, lessons, videos, resources, and quizzes...");

  const now = Date.now();
  const DAY_MS = 24 * 60 * 60 * 1000;

  // ============================================================================
  // Course 1: Fullstack NestJS & Next.js Masterclass (PUBLISHED, INTERMEDIATE)
  // Teacher: Alex Rivers (teacher1), Category: Web Development
  // ============================================================================
  const course1 = await prisma.course.create({
    data: {
      title: "Fullstack NestJS & Next.js Masterclass",
      slug: "fullstack-nestjs-nextjs-masterclass-k9x1z2",
      description:
        "Comprehensive, production-grade fullstack web engineering with NestJS, Next.js 15 App Router, Prisma ORM v7, Redis caching, and RabbitMQ event-driven architecture.",
      thumbnailUrl:
        "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800&auto=format&fit=crop",
      level: "INTERMEDIATE",
      status: "PUBLISHED",
      publishedAt: new Date(now - 30 * DAY_MS),
      categoryId: categories.catWeb.id,
      teacherId: users.teacher1.id,
      chapters: {
        create: [
          {
            title: "Chapter 1: NestJS Architecture & Essentials",
            description: "Understanding modular monolith architecture, Dependency Injection, and Prisma ORM persistence.",
            order: 1,
            lessons: {
              create: [
                {
                  title: "Lesson 1: Modular Architecture & Dependency Injection",
                  description: "Deep dive into Controllers, Providers, Dynamic Modules, and the NestJS IoC container lifecycle.",
                  order: 1,
                  video: {
                    create: {
                      title: "Modular Architecture Deep Dive",
                      videoUrl:
                        "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
                      durationSeconds: 600,
                    },
                  },
                  resources: {
                    create: [
                      {
                        name: "NestJS Execution Lifecycle Cheat Sheet.pdf",
                        fileUrl: "https://raw.githubusercontent.com/nestjs/nest/master/README.md",
                        fileType: "pdf",
                        fileSize: 254000,
                      },
                    ],
                  },
                  quiz: {
                    create: {
                      title: "NestJS Core Fundamentals Quiz",
                      description: "Test your architectural knowledge of NestJS modules, providers, and IoC containers.",
                      passScore: 80,
                      questions: {
                        create: [
                          {
                            content: "What design pattern is central to NestJS dependency management?",
                            order: 1,
                            points: 1,
                            answers: {
                              create: [
                                {
                                  content: "Dependency Injection and Inversion of Control",
                                  isCorrect: true,
                                },
                                { content: "Active Record pattern", isCorrect: false },
                                { content: "Procedural scripting", isCorrect: false },
                                {
                                  content: "Global Singleton registry without injector",
                                  isCorrect: false,
                                },
                              ],
                            },
                          },
                          {
                            content: "Which decorator registers a class as an injectable provider in NestJS?",
                            order: 2,
                            points: 1,
                            answers: {
                              create: [
                                { content: "@Injectable()", isCorrect: true },
                                { content: "@Provider()", isCorrect: false },
                                { content: "@Service()", isCorrect: false },
                                { content: "@Component()", isCorrect: false },
                              ],
                            },
                          },
                        ],
                      },
                    },
                  },
                },
                {
                  title: "Lesson 2: Prisma ORM v7 & Database Persistence",
                  description: "Working with declarative schema modeling, migrations, driver adapters (@prisma/adapter-pg), and relations.",
                  order: 2,
                  video: {
                    create: {
                      title: "Prisma Schema & Driver Adapters",
                      videoUrl:
                        "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
                      durationSeconds: 480,
                    },
                  },
                  resources: {
                    create: [
                      {
                        name: "Database Schema & Migration Guide.pdf",
                        fileUrl: "https://raw.githubusercontent.com/prisma/prisma/main/README.md",
                        fileType: "pdf",
                        fileSize: 312000,
                      },
                    ],
                  },
                },
              ],
            },
          },
          {
            title: "Chapter 2: Next.js App Router & Fullstack Integration",
            description: "Building responsive frontends with React 19, Server Components, and real-time backend synchronization.",
            order: 2,
            lessons: {
              create: [
                {
                  title: "Lesson 3: Server Components & TanStack Query",
                  description: "Mastering React Server Components (RSC), Client boundaries, and optimistic caching with React Query.",
                  order: 1,
                  video: {
                    create: {
                      title: "Next.js 15 Server Components vs Client Components",
                      videoUrl:
                        "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
                      durationSeconds: 720,
                    },
                  },
                  quiz: {
                    create: {
                      title: "React Server Components Assessment",
                      description: "Evaluate your understanding of server-side data fetching and client boundaries.",
                      passScore: 80,
                      questions: {
                        create: [
                          {
                            content: "Where do React Server Components (RSC) execute by default in Next.js App Router?",
                            order: 1,
                            points: 1,
                            answers: {
                              create: [
                                {
                                  content: "Exclusively on the server during request or build time",
                                  isCorrect: true,
                                },
                                { content: "In the client browser via Web Workers", isCorrect: false },
                                { content: "In Service Worker cache", isCorrect: false },
                                { content: "Both client and server simultaneously", isCorrect: false },
                              ],
                            },
                          },
                          {
                            content: "Which directive marks a component file as a Client Component in Next.js?",
                            order: 2,
                            points: 1,
                            answers: {
                              create: [
                                { content: "'use client'", isCorrect: true },
                                { content: "'use client-side'", isCorrect: false },
                                { content: "@ClientComponent", isCorrect: false },
                                { content: "'client only'", isCorrect: false },
                              ],
                            },
                          },
                        ],
                      },
                    },
                  },
                },
                {
                  title: "Lesson 4: Redis Caching & RabbitMQ Asynchronous Events",
                  description: "Optimizing throughput with Redis Cache-Aside and decoupling distributed workloads via RabbitMQ.",
                  order: 2,
                  video: {
                    create: {
                      title: "Distributed Caching & Async Events",
                      videoUrl:
                        "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
                      durationSeconds: 540,
                    },
                  },
                  resources: {
                    create: [
                      {
                        name: "Distributed System Architecture Diagram.png",
                        fileUrl: "https://raw.githubusercontent.com/redis/redis/unstable/README.md",
                        fileType: "png",
                        fileSize: 450000,
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    include: {
      chapters: {
        include: {
          lessons: {
            include: {
              video: true,
              quiz: {
                include: {
                  questions: {
                    include: {
                      answers: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  // ============================================================================
  // Course 2: Docker & Kubernetes for Modern Developers (PUBLISHED, BEGINNER)
  // Teacher: Sarah Chen (teacher2), Category: DevOps & Cloud
  // ============================================================================
  const course2 = await prisma.course.create({
    data: {
      title: "Docker & Kubernetes for Modern Developers",
      slug: "docker-kubernetes-for-modern-developers-m4x8b2",
      description:
        "Zero to hero containerization, Docker multi-stage builds, Docker Compose orchestration, and Kubernetes pod management for cloud developers.",
      thumbnailUrl:
        "https://images.unsplash.com/photo-1605745341112-85968b19335b?w=800&auto=format&fit=crop",
      level: "BEGINNER",
      status: "PUBLISHED",
      publishedAt: new Date(now - 20 * DAY_MS),
      categoryId: categories.catDevOps.id,
      teacherId: users.teacher2.id,
      chapters: {
        create: [
          {
            title: "Chapter 1: Container Fundamentals with Docker",
            description: "Understanding OCI containers, image layers, and reproducible local development environments.",
            order: 1,
            lessons: {
              create: [
                {
                  title: "Lesson 1: Virtual Machines vs Linux Containers",
                  description: "Architectural comparison between hypervisors and kernel namespaces/cgroups.",
                  order: 1,
                  video: {
                    create: {
                      title: "Introduction to Containerization",
                      videoUrl:
                        "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
                      durationSeconds: 360,
                    },
                  },
                  resources: {
                    create: [
                      {
                        name: "Docker Quick Reference.pdf",
                        fileUrl: "https://docs.docker.com",
                        fileType: "pdf",
                        fileSize: 185000,
                      },
                    ],
                  },
                },
                {
                  title: "Lesson 2: Writing Production Dockerfiles & Multi-Stage Builds",
                  description: "Creating lean, secure container images using multi-stage builds and non-root users.",
                  order: 2,
                  video: {
                    create: {
                      title: "Multi-Stage Docker Builds",
                      videoUrl:
                        "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyBlazes.mp4",
                      durationSeconds: 420,
                    },
                  },
                  quiz: {
                    create: {
                      title: "Docker Fundamentals Quiz",
                      description: "Verify your knowledge of Dockerfiles, layers, and build optimization.",
                      passScore: 75,
                      questions: {
                        create: [
                          {
                            content: "What is the primary benefit of multi-stage Docker builds?",
                            order: 1,
                            points: 1,
                            answers: {
                              create: [
                                {
                                  content: "Minimizing final image size by discarding build tools and intermediate artifacts",
                                  isCorrect: true,
                                },
                                { content: "Running multiple containers inside a single image", isCorrect: false },
                                { content: "Automatically configuring Kubernetes pods", isCorrect: false },
                              ],
                            },
                          },
                          {
                            content: "Which command builds a Docker image from a Dockerfile in the current directory?",
                            order: 2,
                            points: 1,
                            answers: {
                              create: [
                                { content: "docker build -t app:latest .", isCorrect: true },
                                { content: "docker run app:latest", isCorrect: false },
                                { content: "docker create .", isCorrect: false },
                              ],
                            },
                          },
                        ],
                      },
                    },
                  },
                },
              ],
            },
          },
          {
            title: "Chapter 2: Kubernetes Orchestration Essentials",
            description: "Deploying, scaling, and managing containerized applications on Kubernetes clusters.",
            order: 2,
            lessons: {
              create: [
                {
                  title: "Lesson 3: Pods, Deployments, and Services Explained",
                  description: "Core primitives of Kubernetes: Pod lifecycle, ReplicaSets, rolling updates, and ClusterIP services.",
                  order: 1,
                  video: {
                    create: {
                      title: "Kubernetes Architecture Overview",
                      videoUrl:
                        "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4",
                      durationSeconds: 600,
                    },
                  },
                  resources: {
                    create: [
                      {
                        name: "Kubernetes Cheatsheet.pdf",
                        fileUrl: "https://kubernetes.io/docs",
                        fileType: "pdf",
                        fileSize: 290000,
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    include: {
      chapters: {
        include: {
          lessons: {
            include: {
              video: true,
              quiz: {
                include: {
                  questions: {
                    include: {
                      answers: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  // ============================================================================
  // Course 3: Production React Native & Mobile Architecture (PUBLISHED, ADVANCED)
  // Teacher: Marcus Vance (teacher3), Category: Mobile Development
  // ============================================================================
  const course3 = await prisma.course.create({
    data: {
      title: "Production React Native & Mobile Architecture",
      slug: "production-react-native-mobile-architecture-y7k3p1",
      description:
        "Master cross-platform mobile development with React Native, New Architecture (TurboModules & Fabric), native navigation, and offline-first data sync.",
      thumbnailUrl:
        "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=800&auto=format&fit=crop",
      level: "ADVANCED",
      status: "PUBLISHED",
      publishedAt: new Date(now - 15 * DAY_MS),
      categoryId: categories.catMobile.id,
      teacherId: users.teacher3.id,
      chapters: {
        create: [
          {
            title: "Chapter 1: React Native New Architecture",
            description: "Deep dive into JSI, Fabric renderer, and TurboModules native interoperability.",
            order: 1,
            lessons: {
              create: [
                {
                  title: "Lesson 1: Fabric Renderer and TurboModules",
                  description: "Understanding synchronous native calls and performance gains over the legacy JSON bridge.",
                  order: 1,
                  video: {
                    create: {
                      title: "Understanding React Native New Architecture",
                      videoUrl:
                        "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4",
                      durationSeconds: 450,
                    },
                  },
                  quiz: {
                    create: {
                      title: "React Native Architecture Quiz",
                      description: "Evaluate your understanding of JSI, TurboModules, and Fabric.",
                      passScore: 80,
                      questions: {
                        create: [
                          {
                            content: "What replaces the legacy asynchronous JSON Bridge in React Native's New Architecture?",
                            order: 1,
                            points: 1,
                            answers: {
                              create: [
                                {
                                  content: "JavaScript Interface (JSI) enabling direct C++ synchronous calls",
                                  isCorrect: true,
                                },
                                { content: "REST API endpoints running locally", isCorrect: false },
                                { content: "WebSocket connections", isCorrect: false },
                              ],
                            },
                          },
                          {
                            content: "What is Fabric in React Native?",
                            order: 2,
                            points: 1,
                            answers: {
                              create: [
                                { content: "The new native rendering engine", isCorrect: true },
                                { content: "A CSS-in-JS library", isCorrect: false },
                                { content: "An offline database", isCorrect: false },
                              ],
                            },
                          },
                        ],
                      },
                    },
                  },
                },
                {
                  title: "Lesson 2: Offline-First Synchronization & Persistence",
                  description: "Architecting reliable offline SQLite storage and background delta sync.",
                  order: 2,
                  video: {
                    create: {
                      title: "Offline Persistence with WatermelonDB",
                      videoUrl:
                        "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackSeeTheWorld.mp4",
                      durationSeconds: 550,
                    },
                  },
                  resources: {
                    create: [
                      {
                        name: "Mobile Architecture Diagram.pdf",
                        fileUrl: "https://reactnative.dev",
                        fileType: "pdf",
                        fileSize: 340000,
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    include: {
      chapters: {
        include: {
          lessons: {
            include: {
              video: true,
              quiz: {
                include: {
                  questions: {
                    include: {
                      answers: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  // ============================================================================
  // Course 4: Python for Data Science & Machine Learning (PUBLISHED, BEGINNER)
  // Teacher: Marcus Vance (teacher3), Category: Data Science & AI
  // ============================================================================
  const course4 = await prisma.course.create({
    data: {
      title: "Python for Data Science & Machine Learning",
      slug: "python-for-data-science-machine-learning-d2w9q5",
      description:
        "Essential data science toolkit with NumPy, Pandas, Matplotlib, Scikit-Learn, and fundamental machine learning algorithms.",
      thumbnailUrl:
        "https://images.unsplash.com/photo-1555949963-ff9fe0c870eb?w=800&auto=format&fit=crop",
      level: "BEGINNER",
      status: "PUBLISHED",
      publishedAt: new Date(now - 10 * DAY_MS),
      categoryId: categories.catAI.id,
      teacherId: users.teacher3.id,
      chapters: {
        create: [
          {
            title: "Chapter 1: Data Analysis with Pandas & NumPy",
            description: "High-performance vector arrays, tabular data wrangling, and exploratory visualizations.",
            order: 1,
            lessons: {
              create: [
                {
                  title: "Lesson 1: Data Wrangling & Exploratory Analysis",
                  description: "Cleaning messy datasets, handling nulls, grouping aggregations, and feature engineering.",
                  order: 1,
                  video: {
                    create: {
                      title: "Pandas DataFrame Foundations",
                      videoUrl:
                        "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4",
                      durationSeconds: 400,
                    },
                  },
                },
                {
                  title: "Lesson 2: Supervised Learning with Scikit-Learn",
                  description: "Building, training, and evaluating regression and classification machine learning models.",
                  order: 2,
                  video: {
                    create: {
                      title: "Training Your First ML Classifier",
                      videoUrl:
                        "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4",
                      durationSeconds: 500,
                    },
                  },
                  resources: {
                    create: [
                      {
                        name: "ML Algorithms Cheatsheet.pdf",
                        fileUrl: "https://scikit-learn.org",
                        fileType: "pdf",
                        fileSize: 410000,
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    include: {
      chapters: {
        include: {
          lessons: {
            include: {
              video: true,
            },
          },
        },
      },
    },
  });

  // ============================================================================
  // Course 5: Advanced Microservices with NestJS & RabbitMQ (DRAFT - Incomplete)
  // Teacher: Alex Rivers (teacher1), Category: Web Development
  // Purpose: Missing video -> tests BR-CRS-02 checklist failure (HTTP 422)
  // ============================================================================
  const course5 = await prisma.course.create({
    data: {
      title: "Advanced Microservices with NestJS & RabbitMQ",
      slug: "advanced-microservices-nestjs-rabbitmq-v5t1r9",
      description:
        "Event-driven microservices pattern with NestJS microservices transport, RabbitMQ exchanges, message deduplication, and transactional outbox.",
      thumbnailUrl:
        "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800&auto=format&fit=crop",
      level: "ADVANCED",
      status: "DRAFT",
      publishedAt: null,
      categoryId: categories.catWeb.id,
      teacherId: users.teacher1.id,
      chapters: {
        create: [
          {
            title: "Chapter 1: Event-Driven Design Patterns",
            description: "Designing loosely coupled microservice architectures with asynchronous event brokers.",
            order: 1,
            lessons: {
              create: [
                {
                  title: "Lesson 1: Message Broker Topology & Exchanges",
                  description: "Configuring topic exchanges, routing keys, and durable dead-letter queues.",
                  order: 1,
                  // Intentionally NO video to test Publish-Ready checklist validation error!
                },
              ],
            },
          },
        ],
      },
    },
    include: {
      chapters: {
        include: {
          lessons: true,
        },
      },
    },
  });

  // ============================================================================
  // Course 6: Cloud Native Infrastructure on AWS & Terraform (DRAFT - Publish Ready)
  // Teacher: Sarah Chen (teacher2), Category: DevOps & Cloud
  // Purpose: Fully valid -> tests successful publishing flow (Status -> PUBLISHED)
  // ============================================================================
  const course6 = await prisma.course.create({
    data: {
      title: "Cloud Native Infrastructure on AWS & Terraform",
      slug: "cloud-native-infrastructure-aws-terraform-h8j4c7",
      description:
        "Infrastructure as Code (IaC) with Terraform, provisioning secure VPCs, ECS Fargate clusters, RDS PostgreSQL, and automated deployment pipelines.",
      thumbnailUrl:
        "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&auto=format&fit=crop",
      level: "INTERMEDIATE",
      status: "DRAFT",
      publishedAt: null,
      categoryId: categories.catDevOps.id,
      teacherId: users.teacher2.id,
      chapters: {
        create: [
          {
            title: "Chapter 1: Infrastructure as Code Foundations",
            description: "Modular Terraform architecture, state management, and backend S3 locking.",
            order: 1,
            lessons: {
              create: [
                {
                  title: "Lesson 1: Terraform Providers, State & Modules",
                  description: "Managing infrastructure idempotency and remote state locking with DynamoDB.",
                  order: 1,
                  video: {
                    create: {
                      title: "Terraform State Management Best Practices",
                      videoUrl:
                        "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WhatCarCanYouGetForAGrand.mp4",
                      durationSeconds: 480,
                    },
                  },
                  quiz: {
                    create: {
                      title: "Terraform Essentials Quiz",
                      description: "Evaluate your knowledge of Terraform commands and state handling.",
                      passScore: 80,
                      questions: {
                        create: [
                          {
                            content: "What file stores the managed infrastructure mapping in Terraform?",
                            order: 1,
                            points: 1,
                            answers: {
                              create: [
                                { content: "terraform.tfstate", isCorrect: true },
                                { content: "terraform.lock.hcl", isCorrect: false },
                                { content: "infrastructure.json", isCorrect: false },
                              ],
                            },
                          },
                          {
                            content: "Which command previews planned changes before applying in Terraform?",
                            order: 2,
                            points: 1,
                            answers: {
                              create: [
                                { content: "terraform plan", isCorrect: true },
                                { content: "terraform validate", isCorrect: false },
                                { content: "terraform check", isCorrect: false },
                              ],
                            },
                          },
                        ],
                      },
                    },
                  },
                },
                {
                  title: "Lesson 2: Provisioning High-Availability AWS VPC",
                  description: "Creating public/private subnets, NAT gateways, and secure security groups.",
                  order: 2,
                  video: {
                    create: {
                      title: "VPC Subnet & Gateway Architecture",
                      videoUrl:
                        "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
                      durationSeconds: 520,
                    },
                  },
                },
              ],
            },
          },
        ],
      },
    },
    include: {
      chapters: {
        include: {
          lessons: {
            include: {
              video: true,
              quiz: {
                include: {
                  questions: {
                    include: {
                      answers: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  // ============================================================================
  // Course 7: Legacy Monolith to Modular Architecture (ARCHIVED)
  // Teacher: Alex Rivers (teacher1), Category: Web Development
  // Purpose: Archived -> hidden from public discovery, read-only for enrolled students
  // ============================================================================
  const course7 = await prisma.course.create({
    data: {
      title: "Legacy Monolith to Modular Architecture",
      slug: "legacy-monolith-to-modular-architecture-x3p9m8",
      description:
        "Historical reference course: migrating large monolithic legacy codebases to modular boundaries. Preserved for enrolled students.",
      thumbnailUrl:
        "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=800&auto=format&fit=crop",
      level: "ADVANCED",
      status: "ARCHIVED",
      publishedAt: new Date(now - 90 * DAY_MS),
      categoryId: categories.catWeb.id,
      teacherId: users.teacher1.id,
      chapters: {
        create: [
          {
            title: "Chapter 1: Strangler Fig Pattern",
            description: "Techniques for incrementally replacing monolithic components with modular services.",
            order: 1,
            lessons: {
              create: [
                {
                  title: "Lesson 1: Domain Analysis & Module Boundary Identification",
                  description: "Mapping legacy dependencies and carving out independent service boundaries.",
                  order: 1,
                  video: {
                    create: {
                      title: "Decomposing the Monolith",
                      videoUrl:
                        "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
                      durationSeconds: 450,
                    },
                  },
                },
                {
                  title: "Lesson 2: Incremental Database Migration Strategies",
                  description: "Dual-writing, data synchronization, and zero-downtime cutover patterns.",
                  order: 2,
                  video: {
                    create: {
                      title: "Zero-Downtime Data Migration",
                      videoUrl:
                        "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
                      durationSeconds: 490,
                    },
                  },
                },
              ],
            },
          },
        ],
      },
    },
    include: {
      chapters: {
        include: {
          lessons: {
            include: {
              video: true,
            },
          },
        },
      },
    },
  });

  console.log(
    "✓ Seeded 7 courses: 4 Published (multi-chapter/lesson/quiz/video), 1 Draft (failing checklist), 1 Draft (publish-ready), 1 Archived.",
  );

  return {
    course1,
    course2,
    course3,
    course4,
    course5,
    course6,
    course7,
  };
}

export type SeededCourses = Awaited<ReturnType<typeof seedCourses>>;
