import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { ConfigModule } from "@nestjs/config";
import { AuthModule } from "../src/auth/auth.module";
import { PrismaModule } from "../src/prisma/prisma.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { NotificationsService } from "../src/notifications/notifications.service";
import { NotificationsController } from "../src/notifications/notifications.controller";
import { NotificationType, Role } from "../src/generated/prisma/client";
import { RolesGuard } from "../src/auth/guards/roles.guard";
import { Reflector } from "@nestjs/core";

describe("Phase 10 - Cụm 1: Notifications Module (TDD)", () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let service: NotificationsService;
  let controller: NotificationsController;

  let studentAId: string;
  let studentBId: string;
  let teacherId: string;
  let adminId: string;
  let inactiveUserId: string;

  const timestamp = Date.now();

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        PrismaModule,
        AuthModule,
      ],
      controllers: [NotificationsController],
      providers: [NotificationsService, RolesGuard, Reflector],
    }).compile();

    prisma = moduleRef.get<PrismaService>(PrismaService);
    service = moduleRef.get<NotificationsService>(NotificationsService);
    controller = moduleRef.get<NotificationsController>(NotificationsController);

    // Create test users
    const studentA = await prisma.user.create({
      data: {
        email: `student_a_notif_${timestamp}@eduhub.test`,
        passwordHash: "hashed_pwd",
        fullName: "Notification Student A",
        role: Role.STUDENT,
        isActive: true,
      },
    });
    studentAId = studentA.id;

    const studentB = await prisma.user.create({
      data: {
        email: `student_b_notif_${timestamp}@eduhub.test`,
        passwordHash: "hashed_pwd",
        fullName: "Notification Student B",
        role: Role.STUDENT,
        isActive: true,
      },
    });
    studentBId = studentB.id;

    const teacher = await prisma.user.create({
      data: {
        email: `teacher_notif_${timestamp}@eduhub.test`,
        passwordHash: "hashed_pwd",
        fullName: "Notification Teacher",
        role: Role.TEACHER,
        isActive: true,
      },
    });
    teacherId = teacher.id;

    const admin = await prisma.user.create({
      data: {
        email: `admin_notif_${timestamp}@eduhub.test`,
        passwordHash: "hashed_pwd",
        fullName: "Notification Admin",
        role: Role.ADMIN,
        isActive: true,
      },
    });
    adminId = admin.id;

    const inactiveUser = await prisma.user.create({
      data: {
        email: `inactive_notif_${timestamp}@eduhub.test`,
        passwordHash: "hashed_pwd",
        fullName: "Inactive User",
        role: Role.STUDENT,
        isActive: false,
      },
    });
    inactiveUserId = inactiveUser.id;
  });

  afterAll(async () => {
    // Cleanup notifications & users
    const userIds = [studentAId, studentBId, teacherId, adminId, inactiveUserId].filter(Boolean);
    await prisma.notification.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: userIds } },
    });
    if (moduleRef) {
      await moduleRef.close();
    }
  });

  beforeEach(async () => {
    const userIds = [studentAId, studentBId, teacherId, adminId, inactiveUserId].filter(Boolean);
    await prisma.notification.deleteMany({
      where: { userId: { in: userIds } },
    });
  });

  describe("1. NotificationsService - Query & Pagination", () => {
    it("should return paginated notifications with meta and unreadCount", async () => {
      // Seed 5 notifications for Student A (3 unread, 2 read)
      for (let i = 1; i <= 5; i++) {
        await prisma.notification.create({
          data: {
            userId: studentAId,
            type: NotificationType.COURSE_ENROLLED,
            title: `Notification ${i}`,
            message: `Message ${i}`,
            isRead: i > 3,
            readAt: i > 3 ? new Date() : null,
          },
        });
      }

      const result = await service.getNotifications(studentAId, { page: 1, limit: 3 });

      expect(result.data).toBeDefined();
      expect(result.data.length).toBe(3);
      expect(result.meta).toEqual({
        page: 1,
        limit: 3,
        total: 5,
        totalPages: 2,
        unreadCount: 3,
      });
    });

    it("should filter notifications by isRead = false (unread only)", async () => {
      await prisma.notification.create({
        data: {
          userId: studentAId,
          type: NotificationType.COURSE_ENROLLED,
          title: "Unread 1",
          message: "Unread Msg",
          isRead: false,
        },
      });
      await prisma.notification.create({
        data: {
          userId: studentAId,
          type: NotificationType.COURSE_COMPLETED,
          title: "Read 1",
          message: "Read Msg",
          isRead: true,
          readAt: new Date(),
        },
      });

      const result = await service.getNotifications(studentAId, {
        page: 1,
        limit: 10,
        isRead: false,
      });

      expect(result.data.length).toBe(1);
      expect(result.data[0].title).toBe("Unread 1");
      expect(result.meta.unreadCount).toBe(1);
    });

    it("should filter notifications by isRead = true (read only)", async () => {
      await prisma.notification.create({
        data: {
          userId: studentAId,
          type: NotificationType.COURSE_ENROLLED,
          title: "Unread 1",
          message: "Unread Msg",
          isRead: false,
        },
      });
      await prisma.notification.create({
        data: {
          userId: studentAId,
          type: NotificationType.COURSE_COMPLETED,
          title: "Read 1",
          message: "Read Msg",
          isRead: true,
          readAt: new Date(),
        },
      });

      const result = await service.getNotifications(studentAId, {
        page: 1,
        limit: 10,
        isRead: true,
      });

      expect(result.data.length).toBe(1);
      expect(result.data[0].title).toBe("Read 1");
      expect(result.meta.unreadCount).toBe(1);
    });

    it("should sort notifications by createdAt DESC", async () => {
      const notif1 = await prisma.notification.create({
        data: {
          userId: studentAId,
          type: NotificationType.COURSE_ENROLLED,
          title: "First Notif",
          message: "First Msg",
          createdAt: new Date(Date.now() - 10000),
        },
      });
      const notif2 = await prisma.notification.create({
        data: {
          userId: studentAId,
          type: NotificationType.COURSE_COMPLETED,
          title: "Second Notif",
          message: "Second Msg",
          createdAt: new Date(),
        },
      });

      const result = await service.getNotifications(studentAId, { page: 1, limit: 10 });
      expect(result.data[0].id).toBe(notif2.id);
      expect(result.data[1].id).toBe(notif1.id);
    });

    it("should not return notifications belonging to another user", async () => {
      await prisma.notification.create({
        data: {
          userId: studentBId,
          type: NotificationType.COURSE_ENROLLED,
          title: "Student B Notif",
          message: "Student B Msg",
        },
      });

      const result = await service.getNotifications(studentAId, { page: 1, limit: 10 });
      expect(result.data.length).toBe(0);
      expect(result.meta.total).toBe(0);
      expect(result.meta.unreadCount).toBe(0);
    });
  });

  describe("2. NotificationsService - Mark Read & Ownership [BR-NTF-03]", () => {
    it("should successfully mark an unread notification as read", async () => {
      const notif = await prisma.notification.create({
        data: {
          userId: studentAId,
          type: NotificationType.COURSE_ENROLLED,
          title: "Mark Me Read",
          message: "Test Msg",
          isRead: false,
        },
      });

      const updated = await service.markAsRead(studentAId, notif.id);

      expect(updated.id).toBe(notif.id);
      expect(updated.isRead).toBe(true);
      expect(updated.readAt).toBeInstanceOf(Date);

      // Verify in DB
      const dbNotif = await prisma.notification.findUnique({
        where: { id: notif.id },
      });
      expect(dbNotif?.isRead).toBe(true);
      expect(dbNotif?.readAt).toBeDefined();
    });

    it("should throw NotFoundException if notification does not exist", async () => {
      await expect(
        service.markAsRead(studentAId, "00000000-0000-0000-0000-000000000000"),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw ForbiddenException if user tries to mark read another user's notification [BR-NTF-03]", async () => {
      const notifB = await prisma.notification.create({
        data: {
          userId: studentBId,
          type: NotificationType.COURSE_ENROLLED,
          title: "Student B Private Notif",
          message: "Private Msg",
          isRead: false,
        },
      });

      await expect(
        service.markAsRead(studentAId, notifB.id),
      ).rejects.toThrow(ForbiddenException);
    });

    it("should successfully mark all unread notifications of current user as read", async () => {
      // Create 3 unread for Student A
      for (let i = 1; i <= 3; i++) {
        await prisma.notification.create({
          data: {
            userId: studentAId,
            type: NotificationType.COURSE_ENROLLED,
            title: `Student A Notif ${i}`,
            message: `Msg ${i}`,
            isRead: false,
          },
        });
      }

      // Create 1 unread for Student B
      const notifB = await prisma.notification.create({
        data: {
          userId: studentBId,
          type: NotificationType.COURSE_ENROLLED,
          title: "Student B Notif",
          message: "Msg B",
          isRead: false,
        },
      });

      const result = await service.markAllAsRead(studentAId);
      expect(result.updatedCount).toBe(3);

      // Verify Student A's unread notifications are now 0
      const remainingUnreadA = await prisma.notification.count({
        where: { userId: studentAId, isRead: false },
      });
      expect(remainingUnreadA).toBe(0);

      // Verify Student B's notification remains unread
      const notifBCheck = await prisma.notification.findUnique({
        where: { id: notifB.id },
      });
      expect(notifBCheck?.isRead).toBe(false);
    });
  });

  describe("3. NotificationsService - System Broadcast by Admin [FR-N06]", () => {
    it("should broadcast system announcement to all active users only", async () => {
      const result = await service.sendSystemNotification({
        title: "Platform Maintenance Announcement",
        message: "EduHub will undergo maintenance on Saturday at 2 AM UTC.",
      });

      expect(result).toBeDefined();
      expect(result.recipientCount).toBeGreaterThanOrEqual(4); // studentA, studentB, teacher, admin are active

      // Verify Student A received the system notification
      const notifA = await prisma.notification.findFirst({
        where: {
          userId: studentAId,
          type: NotificationType.SYSTEM_BROADCAST,
        },
      });
      expect(notifA).toBeDefined();
      expect(notifA?.title).toBe("Platform Maintenance Announcement");
      expect(notifA?.message).toContain("EduHub will undergo maintenance");
      expect(notifA?.isRead).toBe(false);

      // Verify Inactive user DID NOT receive the notification
      const notifInactive = await prisma.notification.findFirst({
        where: {
          userId: inactiveUserId,
          type: NotificationType.SYSTEM_BROADCAST,
        },
      });
      expect(notifInactive).toBeNull();
    });

    it("should throw BadRequestException if title or message is empty", async () => {
      await expect(
        service.sendSystemNotification({ title: "", message: "Some message" }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.sendSystemNotification({ title: "Some title", message: "" }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("4. NotificationsController Endpoints & Authorization", () => {
    it("GET /notifications should delegate to service with current user payload", async () => {
      await prisma.notification.create({
        data: {
          userId: studentAId,
          type: NotificationType.COURSE_ENROLLED,
          title: "Controller Test Notif",
          message: "Message",
        },
      });

      const userPayload = { id: studentAId, email: "student_a@test.com", role: Role.STUDENT };
      const response = await controller.findAll(userPayload, { page: 1, limit: 10 });

      expect(response.data).toBeDefined();
      expect(response.data.length).toBe(1);
      expect(response.meta.total).toBe(1);
    });

    it("PATCH /notifications/:id/read should mark notification as read for current user", async () => {
      const notif = await prisma.notification.create({
        data: {
          userId: studentAId,
          type: NotificationType.COURSE_ENROLLED,
          title: "Controller Mark Read",
          message: "Message",
          isRead: false,
        },
      });

      const userPayload = { id: studentAId, email: "student_a@test.com", role: Role.STUDENT };
      const response = await controller.markAsRead(userPayload, notif.id);

      expect(response.isRead).toBe(true);
    });

    it("PATCH /notifications/read-all should mark all as read for current user", async () => {
      await prisma.notification.create({
        data: {
          userId: studentAId,
          type: NotificationType.COURSE_ENROLLED,
          title: "Controller Read All",
          message: "Message",
          isRead: false,
        },
      });

      const userPayload = { id: studentAId, email: "student_a@test.com", role: Role.STUDENT };
      const response = await controller.markAllAsRead(userPayload);

      expect(response.updatedCount).toBeGreaterThanOrEqual(1);
    });

    it("POST /notifications/system should allow Admin to broadcast system notification", async () => {
      const response = await controller.sendSystemNotification({
        title: "Admin System Notice",
        message: "Notice body for all learners",
      });

      expect(response.recipientCount).toBeGreaterThanOrEqual(4);
    });
  });
});
