import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { NotificationsService } from "./notifications.service";
import { QueryNotificationDto } from "./dto/query-notification.dto";
import { CreateSystemNotificationDto } from "./dto/create-system-notification.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/guards/jwt-auth.guard";
import { Role } from "../generated/prisma/client";

@ApiTags("Notifications")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("notifications")
export class NotificationsController {
  constructor(
    @Inject(NotificationsService)
    private readonly notificationsService: NotificationsService,
  ) {}

  @Get()
  @ApiOperation({
    summary: "Get paginated list of current user's notifications",
  })
  @ApiResponse({
    status: 200,
    description: "Paginated list of notifications with unread count",
  })
  @ApiResponse({ status: 401, description: "Unauthorized - Invalid token" })
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryNotificationDto,
  ) {
    return this.notificationsService.getNotifications(user.id, query);
  }

  @Patch("read-all")
  @ApiOperation({
    summary: "Mark all unread notifications of the current user as read",
  })
  @ApiResponse({
    status: 200,
    description: "All unread notifications marked as read successfully",
  })
  @ApiResponse({ status: 401, description: "Unauthorized - Invalid token" })
  async markAllAsRead(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.markAllAsRead(user.id);
  }

  @Patch(":id/read")
  @ApiOperation({
    summary: "Mark a specific notification as read (Owner only)",
  })
  @ApiParam({
    name: "id",
    type: String,
    description: "Notification UUID",
  })
  @ApiResponse({
    status: 200,
    description: "Notification marked as read successfully",
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - You do not own this notification",
  })
  @ApiResponse({ status: 404, description: "Notification not found" })
  async markAsRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    return this.notificationsService.markAsRead(user.id, id);
  }

  @Post("system")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: "Dispatch platform-wide system notification to all active users (Admin only)",
  })
  @ApiBody({ type: CreateSystemNotificationDto })
  @ApiResponse({
    status: 201,
    description: "System notification broadcasted successfully",
  })
  @ApiResponse({
    status: 400,
    description: "Bad Request - Title or message missing/empty",
  })
  @ApiResponse({ status: 403, description: "Forbidden - Admin role required" })
  async sendSystemNotification(@Body() dto: CreateSystemNotificationDto) {
    return this.notificationsService.sendSystemNotification(dto);
  }
}
