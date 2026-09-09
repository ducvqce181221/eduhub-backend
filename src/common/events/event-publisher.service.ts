import { Injectable, Logger, Optional } from "@nestjs/common";
import type { OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import amqp from "amqplib";
import { EVENTS_CONSTANTS } from "./events.constants";

@Injectable()
export class EventPublisherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventPublisherService.name);
  private connection: amqp.ChannelModel | null = null;
  private channel: amqp.Channel | null = null;
  private connected = false;

  constructor(
    @Optional()
    private readonly configService?: ConfigService,
  ) {}

  async onModuleInit() {
    await this.initRabbitMQ();
  }

  private async initRabbitMQ() {
    const url =
      this.configService?.get<string>(
        "RABBITMQ_URL",
        "amqp://guest:guest@localhost:5672",
      ) || "amqp://guest:guest@localhost:5672";

    try {
      this.connection = await amqp.connect(url);
      this.channel = await this.connection.createChannel();

      // Configure Event Exchanges & Queues (Topology)
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

      // Bind routing keys to notifications queue
      await this.channel.bindQueue(
        EVENTS_CONSTANTS.NOTIFICATIONS_QUEUE,
        EVENTS_CONSTANTS.EVENTS_EXCHANGE,
        EVENTS_CONSTANTS.ROUTING_KEYS.COURSE_ENROLLED,
      );

      await this.channel.bindQueue(
        EVENTS_CONSTANTS.NOTIFICATIONS_QUEUE,
        EVENTS_CONSTANTS.EVENTS_EXCHANGE,
        EVENTS_CONSTANTS.ROUTING_KEYS.QUIZ_SUBMITTED,
      );

      await this.channel.bindQueue(
        EVENTS_CONSTANTS.NOTIFICATIONS_QUEUE,
        EVENTS_CONSTANTS.EVENTS_EXCHANGE,
        EVENTS_CONSTANTS.ROUTING_KEYS.COURSE_COMPLETED,
      );

      this.connected = true;
      this.logger.log("RabbitMQ connected and topology declared successfully");

      this.connection.on("error", (err) => {
        this.logger.warn(`RabbitMQ connection error: ${err.message}`);
        this.connected = false;
      });

      this.connection.on("close", () => {
        this.logger.warn("RabbitMQ connection closed");
        this.connected = false;
      });
    } catch (error) {
      this.logger.warn(
        `RabbitMQ initialization failed: ${(error as Error).message}`,
      );
      this.connected = false;
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
      this.logger.warn(`Error closing RabbitMQ connection: ${(err as Error).message}`);
    }
  }

  isConnected(): boolean {
    return this.connected && this.channel !== null;
  }

  getChannel(): amqp.Channel | null {
    return this.channel;
  }

  getConnection(): amqp.ChannelModel | null {
    return this.connection;
  }

  /**
   * Publishes a domain event asynchronously to the RabbitMQ exchange.
   */
  async publish<T>(routingKey: string, payload: T): Promise<boolean> {
    try {
      if (!this.channel) {
        this.logger.warn(
          `RabbitMQ channel not ready. Dropping message for routing key "${routingKey}"`,
        );
        return false;
      }

      const envelope = {
        event: routingKey,
        data: payload,
        timestamp: new Date().toISOString(),
      };

      const buffer = Buffer.from(JSON.stringify(envelope));

      return this.channel.publish(
        EVENTS_CONSTANTS.EVENTS_EXCHANGE,
        routingKey,
        buffer,
        {
          persistent: true,
          contentType: "application/json",
        },
      );
    } catch (error) {
      this.logger.warn(
        `Failed to publish event "${routingKey}": ${(error as Error).message}`,
      );
      return false;
    }
  }
}
