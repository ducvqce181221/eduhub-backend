import { Inject, Injectable, Logger, Optional } from "@nestjs/common";
import type { OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import amqp from "amqplib";
import { PrismaService } from "../../prisma/prisma.service";
import { EVENTS_CONSTANTS } from "./events.constants";
import { NotificationType } from "../../generated/prisma/client";

@Injectable()
export class NotificationConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationConsumer.name);
  private connection: amqp.ChannelModel | null = null;
  private channel: amqp.Channel | null = null;
  private isConsuming = false;

  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Optional()
    private readonly configService?: ConfigService,
  ) {}

  async onModuleInit() {
    await this.startConsumer();
  }

  private async startConsumer() {
    const url =
      this.configService?.get<string>(
        "RABBITMQ_URL",
        "amqp://guest:guest@localhost:5672",
      ) || "amqp://guest:guest@localhost:5672";

    try {
      this.connection = await amqp.connect(url);
      this.channel = await this.connection.createChannel();

      // Ensure topology exists
      await this.channel.assertExchange(
        EVENTS_CONSTANTS.EVENTS_EXCHANGE,
        "topic",
        { durable: true },
      );
      await this.channel.assertExchange(
        EVENTS_CONSTANTS.DEAD_LETTER_EXCHANGE,
        "fanout",
        { durable: true },
      );
      await this.channel.assertQueue(EVENTS_CONSTANTS.DEAD_LETTER_QUEUE, {
        durable: true,
      });
      await this.channel.bindQueue(
        EVENTS_CONSTANTS.DEAD_LETTER_QUEUE,
        EVENTS_CONSTANTS.DEAD_LETTER_EXCHANGE,
        "",
      );

      await this.channel.assertQueue(EVENTS_CONSTANTS.NOTIFICATIONS_QUEUE, {
        durable: true,
        arguments: {
          "x-dead-letter-exchange": EVENTS_CONSTANTS.DEAD_LETTER_EXCHANGE,
        },
      });

      await this.channel.prefetch(10);

      await this.channel.consume(
        EVENTS_CONSTANTS.NOTIFICATIONS_QUEUE,
        async (msg) => {
          if (!msg) return;
          await this.handleMessage(msg);
        },
        { noAck: false },
      );

      this.isConsuming = true;
      this.logger.log("NotificationConsumer started listening for events");
    } catch (error) {
      this.logger.warn(
        `Failed to start NotificationConsumer: ${(error as Error).message}`,
      );
      this.isConsuming = false;
    }
  }

  private async handleMessage(msg: amqp.ConsumeMessage) {
    if (!this.channel) return;

    try {
      const envelope = JSON.parse(msg.content.toString());
      const { event, data } = envelope;

      switch (event) {
        case EVENTS_CONSTANTS.ROUTING_KEYS.COURSE_ENROLLED:
          await this.handleCourseEnrolled(data);
          break;

        case EVENTS_CONSTANTS.ROUTING_KEYS.QUIZ_SUBMITTED:
          await this.handleQuizSubmitted(data);
          break;

        case EVENTS_CONSTANTS.ROUTING_KEYS.COURSE_COMPLETED:
          await this.handleCourseCompleted(data);
          break;

        default:
          this.logger.warn(`Unhandled event type in consumer: ${event}`);
      }

      // Manual Ack only after successful persistence in PostgreSQL [BR-NTF-01]
      this.channel.ack(msg);
    } catch (error) {
      this.logger.error(
        `Error processing notification event: ${(error as Error).message}`,
      );
      await this.handleProcessingFailure(msg, error as Error);
    }
  }

  private async handleCourseEnrolled(data: {
    studentId: string;
    courseId: string;
    courseTitle: string;
  }) {
    await this.prisma.notification.create({
      data: {
        userId: data.studentId,
        type: NotificationType.COURSE_ENROLLED,
        title: `Welcome to ${data.courseTitle}!`,
        message: `You have successfully enrolled in ${data.courseTitle}. Start learning your first lesson today!`,
        isRead: false,
      },
    });
  }

  private async handleQuizSubmitted(data: {
    studentId: string;
    quizId: string;
    score: number;
    isPassed: boolean;
    earnedPoints: number;
    totalPoints: number;
  }) {
    const statusText = data.isPassed ? "Passed 🎉" : "Failed";
    await this.prisma.notification.create({
      data: {
        userId: data.studentId,
        type: NotificationType.QUIZ_SUBMITTED,
        title: `Quiz Attempt Result: ${statusText}`,
        message: `You scored ${data.score}% (${data.earnedPoints}/${data.totalPoints} points). ${
          data.isPassed
            ? "Congratulations on passing the quiz!"
            : "Keep practicing and try again!"
        }`,
        isRead: false,
      },
    });
  }

  private async handleCourseCompleted(data: {
    studentId: string;
    courseId: string;
    courseTitle: string;
  }) {
    await this.prisma.notification.create({
      data: {
        userId: data.studentId,
        type: NotificationType.COURSE_COMPLETED,
        title: `Course Completed: ${data.courseTitle} 🎓`,
        message: `Congratulations! You have successfully completed 100% of the course "${data.courseTitle}". Well done!`,
        isRead: false,
      },
    });
  }

  private async handleProcessingFailure(
    msg: amqp.ConsumeMessage,
    error: Error,
  ) {
    if (!this.channel) return;

    const retryCount = (msg.properties.headers?.["x-retry-count"] as number) || 0;
    const maxRetries = 3;

    try {
      if (retryCount < maxRetries) {
        this.logger.warn(
          `Retrying event (attempt ${retryCount + 1}/${maxRetries}): ${error.message}`,
        );
        this.channel.ack(msg);

        const headers = {
          ...msg.properties.headers,
          "x-retry-count": retryCount + 1,
        };

        this.channel.sendToQueue(
          EVENTS_CONSTANTS.NOTIFICATIONS_QUEUE,
          msg.content,
          { headers, persistent: true },
        );
      } else {
        this.logger.error(
          `Max retries exceeded for message. Routing to Dead-Letter Queue: ${error.message}`,
        );
        this.channel.nack(msg, false, false);
      }
    } catch (channelErr) {
      this.logger.warn(
        `Failed to ack/nack message (channel closing): ${(channelErr as Error).message}`,
      );
    }
  }

  async onModuleDestroy() {
    try {
      if (this.channel) {
        await this.channel.close().catch(() => {});
      }
      if (this.connection) {
        await this.connection.close().catch(() => {});
      }
    } catch (err) {
      this.logger.warn(`Error closing NotificationConsumer: ${(err as Error).message}`);
    }
  }
}
