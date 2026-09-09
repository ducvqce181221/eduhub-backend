import { Controller, Get, Inject } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { HealthService } from "./health.service";
import type { HealthCheckResult } from "./health.service";

@ApiTags("Health")
@Controller("health")
export class HealthController {
  constructor(
    @Inject(HealthService)
    private readonly healthService: HealthService,
  ) {}

  @Get()
  @ApiOperation({ summary: "System health check for Database, Redis, and RabbitMQ" })
  @ApiResponse({
    status: 200,
    description: "Returns health status of the system dependencies",
    schema: {
      example: {
        success: true,
        data: {
          status: "ok",
          database: "connected",
          redis: "connected",
          rabbitmq: "connected",
          timestamp: "2026-08-30T14:30:00.000Z",
        },
      },
    },
  })
  async check(): Promise<HealthCheckResult> {
    return this.healthService.checkHealth();
  }
}
