import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateChapterDto } from "./dto/create-chapter.dto";
import { UpdateChapterDto } from "./dto/update-chapter.dto";
import { ReorderItemDto } from "./dto/reorder-chapters.dto";
import { CourseStatus } from "../generated/prisma/client";

@Injectable()
export class ChaptersService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  async create(courseId: string, dto: CreateChapterDto) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      throw new NotFoundException("Course not found");
    }

    let targetOrder = dto.order;

    // Auto-calculate order as max + 1 if omitted [BR-CRS-05]
    if (targetOrder === undefined || targetOrder === null) {
      const maxChapter = await this.prisma.chapter.findFirst({
        where: { courseId },
        orderBy: { order: "desc" },
      });
      targetOrder = (maxChapter?.order ?? 0) + 1;
    }

    return this.prisma.chapter.create({
      data: {
        title: dto.title.trim(),
        description: dto.description?.trim(),
        order: targetOrder,
        courseId,
      },
    });
  }

  async findOne(id: string) {
    const chapter = await this.prisma.chapter.findUnique({
      where: { id },
      include: {
        lessons: {
          orderBy: { order: "asc" },
          include: {
            video: true,
            resources: true,
          },
        },
      },
    });

    if (!chapter) {
      throw new NotFoundException("Chapter not found");
    }

    return chapter;
  }

  async update(id: string, dto: UpdateChapterDto) {
    const chapter = await this.prisma.chapter.findUnique({
      where: { id },
    });

    if (!chapter) {
      throw new NotFoundException("Chapter not found");
    }

    const updateData: any = {};
    if (dto.title !== undefined) {
      updateData.title = dto.title.trim();
    }
    if (dto.description !== undefined) {
      updateData.description = dto.description.trim();
    }

    return this.prisma.chapter.update({
      where: { id },
      data: updateData,
    });
  }

  async remove(id: string) {
    const chapter = await this.prisma.chapter.findUnique({
      where: { id },
      include: {
        course: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });

    if (!chapter) {
      throw new NotFoundException("Chapter not found");
    }

    // Published Curriculum Floor Protection [BR-CRS-06]
    // If course is PUBLISHED, deleting the last chapter is blocked.
    if (chapter.course.status === CourseStatus.PUBLISHED) {
      const totalChapters = await this.prisma.chapter.count({
        where: { courseId: chapter.course.id },
      });

      if (totalChapters <= 1) {
        throw new BadRequestException(
          "Cannot delete the last chapter of a published course. Please unpublish first.",
        );
      }
    }

    await this.prisma.chapter.delete({
      where: { id },
    });

    return { message: "Chapter deleted successfully" };
  }

  async reorder(courseId: string, orders: ReorderItemDto[]) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      include: {
        chapters: true,
      },
    });

    if (!course) {
      throw new NotFoundException("Course not found");
    }

    const existingChapterIds = new Set(course.chapters.map((c) => c.id));
    for (const item of orders) {
      if (!existingChapterIds.has(item.id)) {
        throw new BadRequestException(
          `Chapter with ID ${item.id} does not belong to course ${courseId}`,
        );
      }
    }

    // Execute inside prisma.$transaction to avoid unique constraint collision on @@unique([courseId, order]) [BR-CRS-05]
    await this.prisma.$transaction(async (tx) => {
      // Step 1: Assign temporary negative orders
      for (let i = 0; i < orders.length; i++) {
        await tx.chapter.update({
          where: { id: orders[i].id },
          data: { order: -(i + 1) },
        });
      }

      // Step 2: Assign target positive orders
      for (const item of orders) {
        await tx.chapter.update({
          where: { id: item.id },
          data: { order: item.order },
        });
      }
    });

    return { message: "Chapters reordered successfully" };
  }
}
