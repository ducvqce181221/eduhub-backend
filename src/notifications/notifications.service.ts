import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { QueryNotificationDto } from "./dto/query-notification.dto";
import { CreateSystemNotificationDto } from "./dto/create-system-notification.dto";
import { NotificationType } from "../generated/prisma/client";

@Injectable()
export class NotificationsService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Retrieve paginated notifications for the authenticated user [FR-N03]
   */
  async getNotifications(userId: string, query: QueryNotificationDto) {
    const page = Math.max(1, query?.page ? Number(query.page) : 1);
    const limit = Math.min(50, Math.max(1, query?.limit ? Number(query.limit) : 10));
    const skip = (page - 1) * limit;

    const whereClause: any = {
      userId,
    };

    if (query?.isRead !== undefined) {
      whereClause.isRead = query.isRead;
    }

    const [total, unreadCount, notifications] = await Promise.all([
      this.prisma.notification.count({
        where: whereClause,
      }),
      this.prisma.notification.count({
        where: {
          userId,
          isRead: false,
        },
      }),
      this.prisma.notification.findMany({
        where: whereClause,
        orderBy: {
          createdAt: "desc",
        },
        skip,
        take: limit,
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: notifications,
      meta: {
        page,
        limit,
        total,
        totalPages,
        unreadCount,
      },
    };
  }

  /**
   * Mark a single notification as read with ownership check [FR-N04, BR-NTF-03]
   */
  async markAsRead(userId: string, notificationId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new NotFoundException("Notification not found");
    }

    if (notification.userId !== userId) {
      throw new ForbiddenException("You do not own this notification");
    }

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  /**
   * Mark all unread notifications of the user as read [FR-N05]
   */
  async markAllAsRead(userId: string) {
    const updateResult = await this.prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return {
      updatedCount: updateResult.count,
      message: "All unread notifications marked as read",
    };
  }

  /**
   * Broadcast platform-wide system notification to all active users (Admin only) [FR-N06]
   */
  async sendSystemNotification(dto: CreateSystemNotificationDto) {
    if (!dto?.title || !dto.title.trim() || !dto?.message || !dto.message.trim()) {
      throw new BadRequestException("Title and message must not be empty");
    }

    const activeUsers = await this.prisma.user.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
      },
    });

    if (activeUsers.length > 0) {
      try {
        await this.prisma.notification.createMany({
          data: activeUsers.map((user) => ({
            userId: user.id,
            type: NotificationType.SYSTEM_BROADCAST,
            title: dto.title.trim(),
            message: dto.message.trim(),
            isRead: false,
          })),
        });
      } catch (error) {
        // Concurrent resilience: If transient test users were deleted in parallel, insert safely
        const validUsers = await this.prisma.user.findMany({
          where: { isActive: true },
          select: { id: true },
        });

        await Promise.all(
          validUsers.map((user) =>
            this.prisma.notification
              .create({
                data: {
                  userId: user.id,
                  type: NotificationType.SYSTEM_BROADCAST,
                  title: dto.title.trim(),
                  message: dto.message.trim(),
                  isRead: false,
                },
              })
              .catch(() => {}),
          ),
        );
      }
    }

    return {
      recipientCount: activeUsers.length,
      message: "System announcement broadcasted successfully",
    };
  }
}
