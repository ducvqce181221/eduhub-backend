import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { ConfigModule } from "@nestjs/config";
import amqp from "amqplib";
import { PrismaModule } from "../src/prisma/prisma.module";
import { EventsModule } from "../src/common/events/events.module";
import { EventPublisherService } from "../src/common/events/event-publisher.service";
import { EVENTS_CONSTANTS } from "../src/common/events/events.constants";

describe("RabbitMQ Infrastructure & Event Publisher (Phase 9 - Cụm 1: Unit & Integration Tests)", () => {
  let moduleRef: TestingModule;
  let publisherService: EventPublisherService;
  let directConnection: amqp.ChannelModel;
  let directChannel: amqp.Channel;

  const rabbitUrl = process.env.RABBITMQ_URL || "amqp://guest:guest@localhost:5672";

  async function waitForMessage(
    queue: string,
    timeoutMs: number = 1000,
  ): Promise<amqp.GetMessage | null> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const msg = await directChannel.get(queue, { noAck: true });
      if (msg !== false) {
        return msg;
      }
      await new Promise((r) => setTimeout(r, 20));
    }
    return null;
  }

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true })],
      providers: [EventPublisherService],
    }).compile();

    // Create a direct connection for test verification
    directConnection = await amqp.connect(rabbitUrl);
    directChannel = await directConnection.createChannel();

    await directChannel.deleteQueue(EVENTS_CONSTANTS.NOTIFICATIONS_QUEUE).catch(() => {});
    await directChannel.deleteQueue(EVENTS_CONSTANTS.DEAD_LETTER_QUEUE).catch(() => {});
    await directChannel.deleteExchange(EVENTS_CONSTANTS.DEAD_LETTER_EXCHANGE).catch(() => {});
    await directChannel.deleteExchange(EVENTS_CONSTANTS.EVENTS_EXCHANGE).catch(() => {});

    publisherService = moduleRef.get<EventPublisherService>(EventPublisherService);
    await publisherService.onModuleInit();

    // Create a dedicated queue for testing publisher routing without racing with NotificationConsumer
    await directChannel.assertQueue("eduhub.test.publisher.queue", { durable: false, autoDelete: true });
    await directChannel.bindQueue("eduhub.test.publisher.queue", EVENTS_CONSTANTS.EVENTS_EXCHANGE, "course.*");
    await directChannel.bindQueue("eduhub.test.publisher.queue", EVENTS_CONSTANTS.EVENTS_EXCHANGE, "quiz.*");
  });

  afterAll(async () => {
    if (directChannel) {
      await directChannel.deleteQueue("eduhub.test.publisher.queue").catch(() => {});
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
    // Purge test queues before each test case
    await directChannel.purgeQueue("eduhub.test.publisher.queue").catch(() => {});
    await directChannel.purgeQueue(EVENTS_CONSTANTS.NOTIFICATIONS_QUEUE).catch(() => {});
    await directChannel.purgeQueue(EVENTS_CONSTANTS.DEAD_LETTER_QUEUE).catch(() => {});
  });

  describe("1. RabbitMQ Topology & Channel Initialization", () => {
    it("should successfully connect and declare exchanges, queues and DLQ bindings", async () => {
      expect(publisherService.isConnected()).toBe(true);

      // Check exchange exists by passive assertion
      await expect(
        directChannel.checkExchange(EVENTS_CONSTANTS.EVENTS_EXCHANGE),
      ).resolves.not.toThrow();

      // Check DLX exchange exists
      await expect(
        directChannel.checkExchange(EVENTS_CONSTANTS.DEAD_LETTER_EXCHANGE),
      ).resolves.not.toThrow();

      // Check main notifications queue exists
      const mainQueue = await directChannel.checkQueue(EVENTS_CONSTANTS.NOTIFICATIONS_QUEUE);
      expect(mainQueue.queue).toBe(EVENTS_CONSTANTS.NOTIFICATIONS_QUEUE);

      // Check dead-letter queue exists
      const dlq = await directChannel.checkQueue(EVENTS_CONSTANTS.DEAD_LETTER_QUEUE);
      expect(dlq.queue).toBe(EVENTS_CONSTANTS.DEAD_LETTER_QUEUE);
    });
  });

  describe("2. Domain Event Publishing (course.enrolled, quiz.submitted, course.completed)", () => {
    it("should publish course.enrolled event and deliver to notifications queue", async () => {
      const payload = {
        studentId: "student-uuid-1",
        courseId: "course-uuid-1",
        courseTitle: "NestJS Microservices Mastery",
        timestamp: new Date().toISOString(),
      };

      const published = await publisherService.publish(
        EVENTS_CONSTANTS.ROUTING_KEYS.COURSE_ENROLLED,
        payload,
      );
      expect(published).toBe(true);

      // Verify message received in notifications queue
      const message = await waitForMessage("eduhub.test.publisher.queue");
      expect(message).not.toBeNull();
      if (message) {
        const received = JSON.parse(message.content.toString());
        expect(received.data).toEqual(payload);
        expect(received.event).toBe(EVENTS_CONSTANTS.ROUTING_KEYS.COURSE_ENROLLED);
        expect(received.timestamp).toBeDefined();
      }
    });

    it("should publish quiz.submitted event and deliver to notifications queue", async () => {
      const payload = {
        studentId: "student-uuid-2",
        quizId: "quiz-uuid-1",
        lessonId: "lesson-uuid-1",
        score: 85,
        isPassed: true,
        earnedPoints: 17,
        totalPoints: 20,
        timestamp: new Date().toISOString(),
      };

      const published = await publisherService.publish(
        EVENTS_CONSTANTS.ROUTING_KEYS.QUIZ_SUBMITTED,
        payload,
      );
      expect(published).toBe(true);

      const message = await waitForMessage("eduhub.test.publisher.queue");
      expect(message).not.toBeNull();
      if (message) {
        const received = JSON.parse(message.content.toString());
        expect(received.data.score).toBe(85);
        expect(received.data.isPassed).toBe(true);
      }
    });

    it("should publish course.completed event and deliver to notifications queue", async () => {
      const payload = {
        studentId: "student-uuid-3",
        courseId: "course-uuid-2",
        courseTitle: "Advanced Redis Architecture",
        timestamp: new Date().toISOString(),
      };

      const published = await publisherService.publish(
        EVENTS_CONSTANTS.ROUTING_KEYS.COURSE_COMPLETED,
        payload,
      );
      expect(published).toBe(true);

      const message = await waitForMessage("eduhub.test.publisher.queue");
      expect(message).not.toBeNull();
      if (message) {
        const received = JSON.parse(message.content.toString());
        expect(received.event).toBe(EVENTS_CONSTANTS.ROUTING_KEYS.COURSE_COMPLETED);
        expect(received.data.courseTitle).toBe("Advanced Redis Architecture");
      }
    });
  });

  describe("3. Resilience & Fault Tolerance (RabbitMQ Error Graceful Fallback)", () => {
    it("should catch publish errors gracefully and return false without throwing exceptions", async () => {
      const faultyPublisher = new EventPublisherService(null as any);
      // Simulate uninitialized or broken channel
      (faultyPublisher as any).channel = null;

      const result = await faultyPublisher.publish("test.event", { test: true });
      expect(result).toBe(false);
    });

    it("should handle publishing when channel.publish throws an internal error", async () => {
      const mockChannel = {
        publish: () => {
          throw new Error("Channel closed by broker");
        },
      } as any;

      const faultyPublisher = new EventPublisherService(null as any);
      (faultyPublisher as any).channel = mockChannel;
      (faultyPublisher as any).connected = true;

      const result = await faultyPublisher.publish("test.event", { test: true });
      expect(result).toBe(false);
    });
  });
});
