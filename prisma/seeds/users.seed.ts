import { PrismaClient } from "../../src/generated/prisma/client";

export async function seedUsers(prisma: PrismaClient, passwordHash: string) {
  console.log("👤 Seeding users...");

  // 1. Admin
  const admin = await prisma.user.create({
    data: {
      email: "admin@eduhub.dev",
      passwordHash,
      fullName: "System Administrator",
      role: "ADMIN",
      isActive: true,
      avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=admin_master",
    },
  });

  // 2. Teachers
  const teacher1 = await prisma.user.create({
    data: {
      email: "teacher1@eduhub.dev",
      passwordHash,
      fullName: "Alex Rivers",
      role: "TEACHER",
      isActive: true,
      avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=alex_rivers",
    },
  });

  const teacher2 = await prisma.user.create({
    data: {
      email: "teacher2@eduhub.dev",
      passwordHash,
      fullName: "Sarah Chen",
      role: "TEACHER",
      isActive: true,
      avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=sarah_chen",
    },
  });

  const teacher3 = await prisma.user.create({
    data: {
      email: "teacher3@eduhub.dev",
      passwordHash,
      fullName: "Marcus Vance",
      role: "TEACHER",
      isActive: true,
      avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=marcus_vance",
    },
  });

  // 3. Students
  const student1 = await prisma.user.create({
    data: {
      email: "student1@eduhub.dev",
      passwordHash,
      fullName: "Alice Learner",
      role: "STUDENT",
      isActive: true,
      avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=alice_learner",
    },
  });

  const student2 = await prisma.user.create({
    data: {
      email: "student2@eduhub.dev",
      passwordHash,
      fullName: "Bob Scholar",
      role: "STUDENT",
      isActive: true,
      avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=bob_scholar",
    },
  });

  const student3 = await prisma.user.create({
    data: {
      email: "student3@eduhub.dev",
      passwordHash,
      fullName: "Charlie Newbie",
      role: "STUDENT",
      isActive: true,
      avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=charlie_newbie",
    },
  });

  const student4 = await prisma.user.create({
    data: {
      email: "student4@eduhub.dev",
      passwordHash,
      fullName: "David Veteran",
      role: "STUDENT",
      isActive: true,
      avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=david_veteran",
    },
  });

  const student5 = await prisma.user.create({
    data: {
      email: "student5@eduhub.dev",
      passwordHash,
      fullName: "Eva Explorer",
      role: "STUDENT",
      isActive: true,
      avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=eva_explorer",
    },
  });

  // 4. Inactive user (for testing BR-USR-03)
  const inactiveUser = await prisma.user.create({
    data: {
      email: "inactive.user@eduhub.dev",
      passwordHash,
      fullName: "Lucas Locked",
      role: "STUDENT",
      isActive: false,
      avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=lucas_locked",
    },
  });

  console.log(`✓ Seeded 10 users: 1 Admin, 3 Teachers, 5 Students, 1 Inactive Student.`);

  return {
    admin,
    teacher1,
    teacher2,
    teacher3,
    student1,
    student2,
    student3,
    student4,
    student5,
    inactiveUser,
  };
}

export type SeededUsers = Awaited<ReturnType<typeof seedUsers>>;
