import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { ConfigModule } from "@nestjs/config";
import amqp from "amqplib";
import { PrismaModule } from "../src/prisma/prisma.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { RedisCacheModule } from "../src/common/cache/redis-cache.module";
import { EventsModule } from "../src/common/events/events.module";
import { EventPublisherService } from "../src/common/events/event-publisher.service";
import { NotificationConsumer } from "../src/common/events/notification.consumer";
import { EnrollmentsService } from "../src/enrollments/enrollments.service";
import { QuizzesService } from "../src/quizzes/quizzes.service";
import { ProgressService } from "../src/progress/progress.service";
import { EVENTS_CONSTANTS } from "../src/common/events/events.constants";
import {
  CourseLevel,
  CourseStatus,
  NotificationType,
  Role,
} from "../src/generated/prisma/client";

describe("Phase 9 - Cụm 3: Domain Event Triggers Integration Tests (BR-NTF-01, BR-NTF-02)", () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let publisher: EventPublisherService;
  let consumer: NotificationConsumer;
  let enrollmentsService: EnrollmentsService;
  let quizzesService: QuizzesService;
  let progressService: ProgressService;

  let directConnection: amqp.ChannelModel;
  let directChannel: amqp.Channel;

  let teacherId: string;
  let studentId: string;
  let categoryId: string;
  let courseId: string;
  let chapterId: string;
  let lessonId: string;
  let quizId: string;
  let questionId: string;
  let answerCorrectId: string;

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

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        PrismaModule,
        RedisCacheModule,
        EventsModule,
      ],
      providers: [
        EnrollmentsService,
        QuizzesService,
        ProgressService,
      ],
    }).compile();

    prisma = moduleRef.get<PrismaService>(PrismaService);
    publisher = moduleRef.get<EventPublisherService>(EventPublisherService);
    consumer = moduleRef.get<NotificationConsumer>(NotificationConsumer);
    enrollmentsService = moduleRef.get<EnrollmentsService>(EnrollmentsService);
    quizzesService = moduleRef.get<QuizzesService>(QuizzesService);
    progressService = moduleRef.get<ProgressService>(ProgressService);

    directConnection = await amqp.connect(rabbitUrl);
    directChannel = await directConnection.createChannel();

    await directChannel.deleteQueue(EVENTS_CONSTANTS.NOTIFICATIONS_QUEUE).catch(() => {});
    await directChannel.deleteQueue(EVENTS_CONSTANTS.DEAD_LETTER_QUEUE).catch(() => {});
    await directChannel.deleteExchange(EVENTS_CONSTANTS.DEAD_LETTER_EXCHANGE).catch(() => {});
    await directChannel.deleteExchange(EVENTS_CONSTANTS.EVENTS_EXCHANGE).catch(() => {});

    await publisher.onModuleInit();
    await consumer.onModuleInit();

    // 1. Seed Users
    const teacher = await prisma.user.create({
      data: {
        email: `evt_teacher_${timestamp}@eduhub.test`,
        passwordHash: "hash",
        fullName: "Event Teacher",
        role: Role.TEACHER,
      },
    });
    teacherId = teacher.id;

    const student = await prisma.user.create({
      data: {
        email: `evt_student_${timestamp}@eduhub.test`,
        passwordHash: "hash",
        fullName: "Event Student",
        role: Role.STUDENT,
      },
    });
    studentId = student.id;

    // 2. Seed Category & Course
    const category = await prisma.category.create({
      data: {
        name: `EvtCat_${timestamp}`,
        slug: `evt-cat-${timestamp}`,
        isActive: true,
      },
    });
    categoryId = category.id;

    const course = await prisma.course.create({
      data: {
        title: `Event Driven Course ${timestamp}`,
        slug: `event-driven-course-${timestamp}`,
        description: "Course for event triggers testing",
        thumbnailUrl: "https://r2.test/thumb.jpg",
        level: CourseLevel.BEGINNER,
        status: CourseStatus.PUBLISHED,
        publishedAt: new Date(),
        teacherId,
        categoryId,
      },
    });
    courseId = course.id;

    // 3. Seed Chapter & Lesson with Video and Quiz
    const chapter = await prisma.chapter.create({
      data: {
        title: "Chapter 1",
        order: 1,
        courseId,
      },
    });
    chapterId = chapter.id;

    const lesson = await prisma.lesson.create({
      data: {
        title: "Lesson 1",
        order: 1,
        chapterId: chapter.id,
      },
    });
    lessonId = lesson.id;

    await prisma.video.create({
      data: {
        lessonId: lesson.id,
        videoUrl: "https://r2.test/video.mp4",
        durationSeconds: 100,
        title: "Lesson 1 Video",
      },
    });

    const quiz = await prisma.quiz.create({
      data: {
        lessonId: lesson.id,
        title: "Lesson 1 Quiz",
        passScore: 80,
      },
    });
    quizId = quiz.id;

    const question = await prisma.question.create({
      data: {
        quizId: quiz.id,
        content: "What is RabbitMQ?",
        points: 10,
        order: 1,
      },
    });
    questionId = question.id;

    const answerCorrect = await prisma.answer.create({
      data: {
        questionId: question.id,
        content: "Message Broker",
        isCorrect: true,
      },
    });
    answerCorrectId = answerCorrect.id;

    await prisma.answer.create({
      data: {
        questionId: question.id,
        content: "Relational Database",
        isCorrect: false,
      },
    });
  });

  afterAll(async () => {
    // Clean up DB
    await prisma.notification.deleteMany({ where: { userId: studentId } });
    await prisma.quizAttemptAnswer.deleteMany({ where: { questionId } });
    await prisma.quizAttempt.deleteMany({ where: { quizId } });
    await prisma.answer.deleteMany({ where: { questionId } });
    await prisma.question.deleteMany({ where: { quizId } });
    await prisma.quiz.deleteMany({ where: { id: quizId } });
    await prisma.video.deleteMany({ where: { lessonId } });
    await prisma.lessonProgress.deleteMany({ where: { lessonId } });
    await prisma.lesson.deleteMany({ where: { id: lessonId } });
    await prisma.chapter.deleteMany({ where: { id: chapterId } });
    await prisma.enrollment.deleteMany({ where: { courseId } });
    await prisma.course.deleteMany({ where: { id: courseId } });
    await prisma.category.deleteMany({ where: { id: categoryId } });
    await prisma.user.deleteMany({ where: { id: { in: [teacherId, studentId] } } });

    if (consumer) {
      await consumer.onModuleDestroy();
    }
    if (publisher) {
      await publisher.onModuleDestroy();
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
    await prisma.notification.deleteMany({ where: { userId: studentId } });
    await directChannel.purgeQueue(EVENTS_CONSTANTS.NOTIFICATIONS_QUEUE).catch(() => {});
  });

  describe("1. Course Enrollment Trigger -> course.enrolled event", () => {
    it("should trigger course.enrolled event upon enrollment and create notification in DB", async () => {
      // 1. Student enrolls in course
      const enrollment = await enrollmentsService.enroll(studentId, courseId);
      expect(enrollment.id).toBeDefined();

      // 2. Verify async consumer received course.enrolled and created notification
      const notification = await waitForNotification(
        studentId,
        NotificationType.COURSE_ENROLLED,
      );

      expect(notification).not.toBeNull();
      expect(notification?.userId).toBe(studentId);
      expect(notification?.type).toBe(NotificationType.COURSE_ENROLLED);
      expect(notification?.title).toContain("Welcome");
    });
  });

  describe("2. Quiz Submission Trigger -> quiz.submitted event", () => {
    it("should trigger quiz.submitted event upon attempt submission and create notification in DB", async () => {
      // 1. Student submits quiz attempt
      const attempt = await quizzesService.submitAttempt(quizId, studentId, {
        answers: [{ questionId, selectedAnswerId: answerCorrectId }],
      });
      expect(attempt.score).toBe(100);
      expect(attempt.isPassed).toBe(true);

      // 2. Verify async consumer created QUIZ_SUBMITTED notification
      const notification = await waitForNotification(
        studentId,
        NotificationType.QUIZ_SUBMITTED,
      );

      expect(notification).not.toBeNull();
      expect(notification?.type).toBe(NotificationType.QUIZ_SUBMITTED);
      expect(notification?.title).toContain("Passed");
    });
  });

  describe("3. 100% Course Completion Trigger -> course.completed event", () => {
    it("should trigger course.completed event when student completes 100% progress and create graduation notification", async () => {
      // 1. Heartbeat watch to 95 seconds (>= 90%)
      const progress = await progressService.updateProgress(
        studentId,
        lessonId,
        { watchedSeconds: 95 },
      );
      expect(progress.isCompleted).toBe(true);

      // 2. Verify async consumer created COURSE_COMPLETED notification
      const notification = await waitForNotification(
        studentId,
        NotificationType.COURSE_COMPLETED,
      );

      expect(notification).not.toBeNull();
      expect(notification?.type).toBe(NotificationType.COURSE_COMPLETED);
      expect(notification?.title).toContain("Completed");
    });
  });
});
