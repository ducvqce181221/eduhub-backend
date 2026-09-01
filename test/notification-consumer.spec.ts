import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { ConfigModule } from "@nestjs/config";
import amqp from "amqplib";
import { PrismaModule } from "../src/prisma/prisma.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { EventsModule } from "../src/common/events/events.module";
import { EventPublisherService } from "../src/common/events/event-publisher.service";
import { NotificationConsumer } from "../src/common/events/notification.consumer";
import { EVENTS_CONSTANTS } from "../src/common/events/events.constants";
import { NotificationType, Role } from "../src/generated/prisma/client";

describe("Notification Consumer Worker & DLQ Routing (Phase 9 - Cụm 2: Integration Tests)", () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let publisher: EventPublisherService;
  let consumer: NotificationConsumer;
  let directConnection: amqp.ChannelModel;
  let directChannel: amqp.Channel;

  let testStudentId: string;
  const timestamp = Date.now();
  const rabbitUrl = process.env.RABBITMQ_URL || "amqp://guest:guest@localhost:5672";

  async function waitForNotification(
    userId: string,
    type: NotificationType,
    timeoutMs: number = 3000,
  ) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const notif = await prisma.notification.findFirst({
        where: { userId, type },
        orderBy: { createdAt: "desc" },
      });
      if (notif) {
        return notif;
      }
      await new Promise((r) => setTimeout(r, 50));
    }
    return null;
  }

  async function waitForDlqMessage(timeoutMs: number = 3000): Promise<amqp.GetMessage | null> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const msg = await directChannel.get(EVENTS_CONSTANTS.DEAD_LETTER_QUEUE, {
        noAck: true,
      });
      if (msg !== false) {
        return msg;
      }
      await new Promise((r) => setTimeout(r, 50));
    }
    return null;
  }

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        PrismaModule,
        EventsModule,
      ],
      providers: [NotificationConsumer],
    }).compile();

    directConnection = await amqp.connect(rabbitUrl);
    directChannel = await directConnection.createChannel();

    // Reset topology if previously created with different exchange type
    await directChannel.deleteQueue(EVENTS_CONSTANTS.NOTIFICATIONS_QUEUE).catch(() => {});
    await directChannel.deleteQueue(EVENTS_CONSTANTS.DEAD_LETTER_QUEUE).catch(() => {});
    await directChannel.deleteExchange(EVENTS_CONSTANTS.DEAD_LETTER_EXCHANGE).catch(() => {});
    await directChannel.deleteExchange(EVENTS_CONSTANTS.EVENTS_EXCHANGE).catch(() => {});

    prisma = moduleRef.get<PrismaService>(PrismaService);
    publisher = moduleRef.get<EventPublisherService>(EventPublisherService);
    consumer = moduleRef.get<NotificationConsumer>(NotificationConsumer);

    await publisher.onModuleInit();
    await consumer.onModuleInit();

    // Create student user for notifications
    const student = await prisma.user.create({
      data: {
        email: `notif_student_${timestamp}@eduhub.test`,
        passwordHash: "hash",
        fullName: "Notification Test Student",
        role: Role.STUDENT,
      },
    });
    testStudentId = student.id;
  });

  afterAll(async () => {
    await prisma.notification.deleteMany({ where: { userId: testStudentId } });
    await prisma.user.deleteMany({ where: { id: testStudentId } });

    if (consumer) {
      await consumer.onModuleDestroy();
    }
    if (directChannel) {
      await directChannel.close().catch(() => {});
    }
    if (directConnection) {
      await directConnection.close().catch(() => {});
    }
    if (moduleRef) {
      await moduleRef.close().catch(() => {});
    }
  });

  beforeEach(async () => {
    await prisma.notification.deleteMany({ where: { userId: testStudentId } });
    await directChannel.purgeQueue(EVENTS_CONSTANTS.NOTIFICATIONS_QUEUE).catch(() => {});
    await directChannel.purgeQueue(EVENTS_CONSTANTS.DEAD_LETTER_QUEUE).catch(() => {});
  });

  describe("1. Consumer Event Handling & Database Persistence (BR-NTF-01, BR-NTF-02)", () => {
    it("should consume course.enrolled event and create COURSE_ENROLLED notification", async () => {
      const courseTitle = "Mastering NestJS Architecture";
      await publisher.publish(EVENTS_CONSTANTS.ROUTING_KEYS.COURSE_ENROLLED, {
        studentId: testStudentId,
        courseId: "course-123",
        courseTitle,
        timestamp: new Date().toISOString(),
      });

      const notification = await waitForNotification(
        testStudentId,
        NotificationType.COURSE_ENROLLED,
      );

      expect(notification).not.toBeNull();
      expect(notification?.userId).toBe(testStudentId);
      expect(notification?.type).toBe(NotificationType.COURSE_ENROLLED);
      expect(notification?.title).toContain("Welcome");
      expect(notification?.message).toContain(courseTitle);
      expect(notification?.isRead).toBe(false);
    });

    it("should consume quiz.submitted event and create QUIZ_SUBMITTED notification", async () => {
      await publisher.publish(EVENTS_CONSTANTS.ROUTING_KEYS.QUIZ_SUBMITTED, {
        studentId: testStudentId,
        quizId: "quiz-123",
        lessonId: "lesson-123",
        score: 90,
        isPassed: true,
        earnedPoints: 18,
        totalPoints: 20,
        timestamp: new Date().toISOString(),
      });

      const notification = await waitForNotification(
        testStudentId,
        NotificationType.QUIZ_SUBMITTED,
      );

      expect(notification).not.toBeNull();
      expect(notification?.type).toBe(NotificationType.QUIZ_SUBMITTED);
      expect(notification?.title).toContain("Passed");
      expect(notification?.message).toContain("90%");
      expect(notification?.isRead).toBe(false);
    });

    it("should consume course.completed event and create COURSE_COMPLETED notification", async () => {
      const courseTitle = "Advanced TypeScript & Microservices";
      await publisher.publish(EVENTS_CONSTANTS.ROUTING_KEYS.COURSE_COMPLETED, {
        studentId: testStudentId,
        courseId: "course-456",
        courseTitle,
        timestamp: new Date().toISOString(),
      });

      const notification = await waitForNotification(
        testStudentId,
        NotificationType.COURSE_COMPLETED,
      );

      expect(notification).not.toBeNull();
      expect(notification?.type).toBe(NotificationType.COURSE_COMPLETED);
      expect(notification?.title).toContain("Completed");
      expect(notification?.message).toContain(courseTitle);
      expect(notification?.isRead).toBe(false);
    });
  });

  describe("2. Retry Discipline & Dead-Letter Queue (DLQ) Routing", () => {
    it("should route unprocessable or invalid messages to Dead-Letter Queue (eduhub.dlq)", async () => {
      // Publish a malformed message (non-existent user causing unrecoverable error or corrupt payload)
      // Directly inject a poison pill / invalid payload into notifications queue
      const invalidEnvelope = {
        event: EVENTS_CONSTANTS.ROUTING_KEYS.COURSE_ENROLLED,
        data: {
          studentId: "00000000-0000-0000-0000-000000000000", // Non-existent foreign key
          courseId: "invalid-id",
          courseTitle: "Corrupt Event",
        },
        timestamp: new Date().toISOString(),
      };

      await directChannel.sendToQueue(
        EVENTS_CONSTANTS.NOTIFICATIONS_QUEUE,
        Buffer.from(JSON.stringify(invalidEnvelope)),
        { headers: { "x-retry-count": 3 } },
      );

      // Verify that message gets rejected and routed to DLQ
      const dlqMessage = await waitForDlqMessage();
      expect(dlqMessage).not.toBeNull();
      if (dlqMessage) {
        const parsed = JSON.parse(dlqMessage.content.toString());
        expect(parsed.data.courseTitle).toBe("Corrupt Event");
      }
    });
  });
});
