import { createPrismaClient } from "../src/lib/prisma";
import bcrypt from "bcryptjs";

const prisma = createPrismaClient();

async function main() {
  console.log("🌱 Starting database seeding...");

  // Password hash for all seeded accounts
  const passwordHash = bcrypt.hashSync("Password123!", 10);

  // 1. Seed Users
  console.log("Seeding users...");
  const admin = await prisma.user.upsert({
    where: { email: "admin@eduhub.dev" },
    update: {},
    create: {
      email: "admin@eduhub.dev",
      passwordHash,
      fullName: "System Admin",
      role: "ADMIN",
      isActive: true,
      avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=admin",
    },
  });

  const teacher1 = await prisma.user.upsert({
    where: { email: "teacher1@eduhub.dev" },
    update: {},
    create: {
      email: "teacher1@eduhub.dev",
      passwordHash,
      fullName: "John Doe",
      role: "TEACHER",
      isActive: true,
      avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=john",
    },
  });

  const teacher2 = await prisma.user.upsert({
    where: { email: "teacher2@eduhub.dev" },
    update: {},
    create: {
      email: "teacher2@eduhub.dev",
      passwordHash,
      fullName: "Jane Smith",
      role: "TEACHER",
      isActive: true,
      avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=jane",
    },
  });

  const student1 = await prisma.user.upsert({
    where: { email: "student1@eduhub.dev" },
    update: {},
    create: {
      email: "student1@eduhub.dev",
      passwordHash,
      fullName: "Alice Learner",
      role: "STUDENT",
      isActive: true,
      avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=alice",
    },
  });

  const student2 = await prisma.user.upsert({
    where: { email: "student2@eduhub.dev" },
    update: {},
    create: {
      email: "student2@eduhub.dev",
      passwordHash,
      fullName: "Bob Scholar",
      role: "STUDENT",
      isActive: true,
      avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=bob",
    },
  });

  console.log(`✓ Seeded users: admin, teacher1, teacher2, student1, student2`);

  // 2. Seed Categories
  console.log("Seeding categories...");
  const catWeb = await prisma.category.upsert({
    where: { slug: "web-development" },
    update: {},
    create: {
      name: "Web Development",
      slug: "web-development",
      description: "Frontend and backend web technologies (React, Next.js, NestJS, Node.js)",
      isActive: true,
    },
  });

  const catMobile = await prisma.category.upsert({
    where: { slug: "mobile-development" },
    update: {},
    create: {
      name: "Mobile Development",
      slug: "mobile-development",
      description: "Cross-platform and native mobile apps (Flutter, React Native, iOS, Android)",
      isActive: true,
    },
  });

  const catAI = await prisma.category.upsert({
    where: { slug: "data-science-ai" },
    update: {},
    create: {
      name: "Data Science & AI",
      slug: "data-science-ai",
      description: "Machine Learning, Deep Learning, AI Engineering, and Python",
      isActive: true,
    },
  });

  const catDevOps = await prisma.category.upsert({
    where: { slug: "devops-cloud" },
    update: {},
    create: {
      name: "DevOps & Cloud",
      slug: "devops-cloud",
      description: "Docker, Kubernetes, AWS, CI/CD, Infrastructure as Code",
      isActive: true,
    },
  });

  console.log(`✓ Seeded categories: Web Dev, Mobile Dev, AI, DevOps`);

  // 3. Seed Courses
  console.log("Seeding courses and curriculum...");
  const publishedCourse = await prisma.course.upsert({
    where: { slug: "fullstack-nestjs-nextjs-masterclass-k9x1z2" },
    update: {},
    create: {
      title: "Fullstack NestJS & Next.js Masterclass",
      slug: "fullstack-nestjs-nextjs-masterclass-k9x1z2",
      description: "Learn to build production-ready fullstack web applications with NestJS, PostgreSQL, Prisma, Redis, RabbitMQ, and Next.js.",
      thumbnailUrl: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97",
      level: "INTERMEDIATE",
      status: "PUBLISHED",
      publishedAt: new Date(),
      categoryId: catWeb.id,
      teacherId: teacher1.id,
      chapters: {
        create: [
          {
            title: "Chapter 1: NestJS Architecture & Essentials",
            description: "Understanding modular monolith architecture, Dependency Injection, and Prisma ORM.",
            order: 1,
            lessons: {
              create: [
                {
                  title: "Lesson 1: Introduction to NestJS & Architecture",
                  description: "Overview of Controllers, Providers, Modules, and NestJS execution lifecycle.",
                  order: 1,
                  video: {
                    create: {
                      title: "Intro to NestJS",
                      videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
                      durationSeconds: 600,
                    },
                  },
                  resources: {
                    create: [
                      {
                        name: "Architecture Diagram.pdf",
                        fileUrl: "https://example.com/eduhub-arch.pdf",
                        fileType: "pdf",
                        fileSize: 204800,
                      },
                    ],
                  },
                  quiz: {
                    create: {
                      title: "NestJS Fundamentals Quiz",
                      description: "Test your understanding of NestJS modules and providers.",
                      passScore: 80,
                      questions: {
                        create: [
                          {
                            content: "What is the primary architectural design pattern utilized by NestJS?",
                            order: 1,
                            points: 1,
                            answers: {
                              create: [
                                { content: "Dependency Injection & Inversion of Control", isCorrect: true },
                                { content: "Procedural Scripting", isCorrect: false },
                                { content: "Microkernel without modules", isCorrect: false },
                              ],
                            },
                          },
                          {
                            content: "Which decorator is used to register a class as an injectable provider in NestJS?",
                            order: 2,
                            points: 1,
                            answers: {
                              create: [
                                { content: "@Injectable()", isCorrect: true },
                                { content: "@Provider()", isCorrect: false },
                                { content: "@Service()", isCorrect: false },
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
                  description: "Working with schema modeling, driver adapters, and PostgreSQL.",
                  order: 2,
                  video: {
                    create: {
                      title: "Prisma ORM Setup",
                      videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
                      durationSeconds: 480,
                    },
                  },
                },
              ],
            },
          },
        ],
      },
    },
  });

  const draftCourse = await prisma.course.upsert({
    where: { slug: "docker-kubernetes-for-developers-p3n8w1" },
    update: {},
    create: {
      title: "Docker & Kubernetes for Developers",
      slug: "docker-kubernetes-for-developers-p3n8w1",
      description: "Master containerization, Docker Compose, and Kubernetes orchestration.",
      thumbnailUrl: "https://images.unsplash.com/photo-1605745341112-85968b19335b",
      level: "BEGINNER",
      status: "DRAFT",
      categoryId: catDevOps.id,
      teacherId: teacher2.id,
      chapters: {
        create: [
          {
            title: "Chapter 1: Getting Started with Docker",
            description: "Containers vs Virtual Machines, Dockerfile basics.",
            order: 1,
            lessons: {
              create: [
                {
                  title: "Lesson 1: What is a Container?",
                  description: "Understanding image layers and container runtimes.",
                  order: 1,
                  video: {
                    create: {
                      title: "Container Basics",
                      videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
                      durationSeconds: 360,
                    },
                  },
                },
              ],
            },
          },
        ],
      },
    },
  });

  console.log(`✓ Seeded course (Published): ${publishedCourse.title}`);
  console.log(`✓ Seeded course (Draft): ${draftCourse.title}`);

  // 4. Seed Sample Enrollment for student1
  await prisma.enrollment.upsert({
    where: {
      studentId_courseId: {
        studentId: student1.id,
        courseId: publishedCourse.id,
      },
    },
    update: {},
    create: {
      studentId: student1.id,
      courseId: publishedCourse.id,
      status: "ACTIVE",
    },
  });

  console.log(`✓ Seeded enrollment for ${student1.email} in ${publishedCourse.title}`);
  console.log("🎉 Seeding completed successfully!");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error("❌ Seeding failed:", error);
    await prisma.$disconnect();
    process.exit(1);
  });
