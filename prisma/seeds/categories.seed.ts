import { PrismaClient } from "../../src/generated/prisma/client";

export async function seedCategories(prisma: PrismaClient) {
  console.log("📂 Seeding categories...");

  // 1. Categories with courses attached
  const catWeb = await prisma.category.create({
    data: {
      name: "Web Development",
      slug: "web-development",
      description: "Modern frontend and backend engineering with TypeScript, React, Next.js, and NestJS.",
      isActive: true,
    },
  });

  const catDevOps = await prisma.category.create({
    data: {
      name: "DevOps & Cloud",
      slug: "devops-cloud",
      description: "Containerization, orchestration, CI/CD pipelines, and cloud infrastructure with Docker, Kubernetes, and AWS.",
      isActive: true,
    },
  });

  const catMobile = await prisma.category.create({
    data: {
      name: "Mobile Development",
      slug: "mobile-development",
      description: "Cross-platform and native mobile application engineering with React Native, Flutter, and Swift.",
      isActive: true,
    },
  });

  const catAI = await prisma.category.create({
    data: {
      name: "Data Science & AI",
      slug: "data-science-ai",
      description: "Applied machine learning, deep neural networks, AI engineering, and data analytics with Python.",
      isActive: true,
    },
  });

  // 2. Empty Category without any courses (To test BR-CAT-02: Admin can delete successfully)
  const catEmpty = await prisma.category.create({
    data: {
      name: "Software Architecture",
      slug: "software-architecture",
      description: "Enterprise system design, microservices architecture, and clean code patterns.",
      isActive: true,
    },
  });

  // 3. Inactive Category (To test BR-CAT-03: Hidden from course creation/editing dropdowns)
  const catInactive = await prisma.category.create({
    data: {
      name: "Legacy Technologies",
      slug: "legacy-technologies",
      description: "Deprecated frameworks and legacy stacks kept for archival documentation only.",
      isActive: false,
    },
  });

  console.log("✓ Seeded 6 categories: 4 active with courses, 1 empty (deletable), 1 inactive.");

  return {
    catWeb,
    catDevOps,
    catMobile,
    catAI,
    catEmpty,
    catInactive,
  };
}

export type SeededCategories = Awaited<ReturnType<typeof seedCategories>>;
