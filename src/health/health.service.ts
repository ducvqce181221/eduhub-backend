import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import Redis from "ioredis";
import * as amqp from "amqplib";

export interface HealthCheckResult {
  status: "ok" | "degraded" | "error";
  database: "connected" | "disconnected";
  redis: "connected" | "disconnected";
  rabbitmq: "connected" | "disconnected";
  timestamp: string;
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(ConfigService)
    private readonly configService: ConfigService,
  ) {}

  async checkHealth(): Promise<HealthCheckResult> {
    const [dbStatus, redisStatus, rabbitStatus] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkRabbitMQ(),
    ]);

    const isAllOk =
      dbStatus === "connected" &&
      redisStatus === "connected" &&
      rabbitStatus === "connected";

    return {
      status: isAllOk ? "ok" : "degraded",
      database: dbStatus,
      redis: redisStatus,
      rabbitmq: rabbitStatus,
      timestamp: new Date().toISOString(),
    };
  }

  private async checkDatabase(): Promise<"connected" | "disconnected"> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return "connected";
    } catch (error) {
      this.logger.error(`Database health check failed: ${(error as Error).message}`);
      return "disconnected";
    }
  }

  private async checkRedis(): Promise<"connected" | "disconnected"> {
    const host = this.configService.get<string>("REDIS_HOST", "localhost");
    const port = Number(this.configService.get<number>("REDIS_PORT", 6379));
    const password = this.configService.get<string>("REDIS_PASSWORD", "");

    const client = new Redis({
      host,
      port,
      password: password || undefined,
      connectTimeout: 2000,
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });

    try {
      await client.connect();
      const pong = await client.ping();
      await client.quit();
      return pong === "PONG" ? "connected" : "disconnected";
    } catch (error) {
      this.logger.error(`Redis health check failed: ${(error as Error).message}`);
      try {
        client.disconnect();
      } catch {}
      return "disconnected";
    }
  }

  private async checkRabbitMQ(): Promise<"connected" | "disconnected"> {
    const url = this.configService.get<string>(
      "RABBITMQ_URL",
      "amqp://guest:guest@localhost:5672",
    );

    try {
      const conn = await amqp.connect(url, { timeout: 2000 });
      await conn.close();
      return "connected";
    } catch (error) {
      this.logger.error(`RabbitMQ health check failed: ${(error as Error).message}`);
      return "disconnected";
    }
  }
}
