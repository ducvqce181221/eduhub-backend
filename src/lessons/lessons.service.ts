import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { RedisCacheService } from "../common/cache/redis-cache.service";
import { CACHE_CONSTANTS } from "../common/cache/cache.constants";
import { CreateLessonDto } from "./dto/create-lesson.dto";
import { UpdateLessonDto } from "./dto/update-lesson.dto";
import { ReorderLessonItemDto } from "./dto/reorder-lessons.dto";
import { UpsertVideoDto } from "./dto/upsert-video.dto";
import { AttachVideoFromLibraryDto } from "./dto/attach-from-library.dto";
import { CourseStatus, Role } from "../generated/prisma/client";
import { R2StorageService } from "../upload/r2-storage.service";

@Injectable()
export class LessonsService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Optional()
    @Inject(RedisCacheService)
    private readonly cacheService?: RedisCacheService,
    @Optional()
    @Inject(R2StorageService)
    private readonly r2StorageService?: R2StorageService,
  ) {}

  private async invalidateCache(): Promise<void> {
    if (this.cacheService) {
      await this.cacheService.delByPattern(CACHE_CONSTANTS.COURSES_LIST_PATTERN);
    }
  }

  async create(chapterId: string, dto: CreateLessonDto) {
    const chapter = await this.prisma.chapter.findUnique({
      where: { id: chapterId },
    });

    if (!chapter) {
      throw new NotFoundException("Chapter not found");
    }

    let targetOrder = dto.order;

    // Auto-calculate order as max + 1 if omitted [BR-CRS-05]
    if (targetOrder === undefined || targetOrder === null) {
      const maxLesson = await this.prisma.lesson.findFirst({
        where: { chapterId },
        orderBy: { order: "desc" },
      });
      targetOrder = (maxLesson?.order ?? 0) + 1;
    }

    const lessonData: any = {
      title: dto.title.trim(),
      description: dto.description?.trim(),
      order: targetOrder,
      chapterId,
    };

    if (dto.videoUrl && dto.durationSeconds) {
      if (dto.durationSeconds <= 0) {
        throw new BadRequestException("durationSeconds must be greater than 0");
      }
      lessonData.video = {
        create: {
          videoUrl: dto.videoUrl.trim(),
          durationSeconds: dto.durationSeconds,
          title: dto.title.trim(),
        },
      };
    }

    const created = await this.prisma.lesson.create({
      data: lessonData,
      include: {
        video: true,
        resources: true,
      },
    });

    await this.invalidateCache();
    return created;
  }

  async findOne(id: string, user?: { id: string; role: string }) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id },
      include: {
        video: true,
        resources: true,
        quiz: {
          include: {
            questions: {
              include: {
                answers: true,
              },
            },
          },
        },
      },
    });

    if (!lesson) {
      throw new NotFoundException("Lesson not found");
    }

    let video = lesson.video;
    if (video && this.r2StorageService && !video.isExternal) {
      const signedVideoUrl = await this.r2StorageService.generatePresignedGetUrl(
        video.videoUrl,
      );
      video = {
        ...video,
        videoUrl: signedVideoUrl,
      };
    }

    let resources = lesson.resources;
    if (resources && resources.length > 0 && this.r2StorageService) {
      resources = await Promise.all(
        resources.map(async (res) => {
          if (!res.isExternal) {
            const signedUrl = await this.r2StorageService!.generatePresignedGetUrl(
              res.fileUrl,
            );
            return {
              ...res,
              fileUrl: signedUrl,
            };
          }
          return res;
        }),
      );
    }

    // Quiz Answer DTO Masking: Mask isCorrect for Students [BR-QZ-06]
    if (lesson.quiz && (!user || user.role === Role.STUDENT)) {
      const maskedQuiz = {
        ...lesson.quiz,
        questions: lesson.quiz.questions.map((q) => ({
          ...q,
          answers: q.answers.map(({ isCorrect, ...rest }) => rest),
        })),
      };

      return {
        ...lesson,
        video,
        resources,
        quiz: maskedQuiz,
      };
    }

    return {
      ...lesson,
      video,
      resources,
    };
  }

  async update(id: string, dto: UpdateLessonDto) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id },
    });

    if (!lesson) {
      throw new NotFoundException("Lesson not found");
    }

    const updateData: any = {};
    if (dto.title !== undefined) {
      updateData.title = dto.title.trim();
    }
    if (dto.description !== undefined) {
      updateData.description = dto.description.trim();
    }

    const updated = await this.prisma.lesson.update({
      where: { id },
      data: updateData,
    });

    await this.invalidateCache();
    return updated;
  }

  async remove(id: string) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id },
      include: {
        chapter: {
          select: {
            id: true,
            course: {
              select: {
                id: true,
                status: true,
              },
            },
          },
        },
      },
    });

    if (!lesson) {
      throw new NotFoundException("Lesson not found");
    }

    // Published Curriculum Floor Protection [BR-CRS-06]
    // If course is PUBLISHED, deleting the last lesson of a chapter is blocked.
    if (lesson.chapter.course.status === CourseStatus.PUBLISHED) {
      const totalLessonsInChapter = await this.prisma.lesson.count({
        where: { chapterId: lesson.chapter.id },
      });

      if (totalLessonsInChapter <= 1) {
        throw new BadRequestException(
          "Cannot delete the last lesson of a chapter in a published course. Please unpublish first.",
        );
      }
    }

    await this.prisma.lesson.delete({
      where: { id },
    });

    await this.invalidateCache();
    return { message: "Lesson deleted successfully" };
  }

  async reorder(chapterId: string, orders: ReorderLessonItemDto[]) {
    const chapter = await this.prisma.chapter.findUnique({
      where: { id: chapterId },
      include: {
        lessons: true,
      },
    });

    if (!chapter) {
      throw new NotFoundException("Chapter not found");
    }

    const existingLessonIds = new Set(chapter.lessons.map((l) => l.id));
    for (const item of orders) {
      if (!existingLessonIds.has(item.id)) {
        throw new BadRequestException(
          `Lesson with ID ${item.id} does not belong to chapter ${chapterId}`,
        );
      }
    }

    // Execute inside prisma.$transaction to avoid unique constraint collision on @@unique([chapterId, order]) [BR-CRS-05]
    await this.prisma.$transaction(async (tx) => {
      // Step 1: Assign temporary negative orders
      for (let i = 0; i < orders.length; i++) {
        await tx.lesson.update({
          where: { id: orders[i].id },
          data: { order: -(i + 1) },
        });
      }

      // Step 2: Assign target positive orders
      for (const item of orders) {
        await tx.lesson.update({
          where: { id: item.id },
          data: { order: item.order },
        });
      }
    });

    await this.invalidateCache();
    return { message: "Lessons reordered successfully" };
  }

  async upsertVideo(lessonId: string, dto: UpsertVideoDto) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        chapter: {
          include: {
            course: true,
          },
        },
      },
    });

    if (!lesson) {
      throw new NotFoundException("Lesson not found");
    }

    if (!dto.durationSeconds || dto.durationSeconds <= 0) {
      throw new BadRequestException("durationSeconds must be greater than 0");
    }

    const teacherId = lesson.chapter.course.teacherId;
    let assetId = dto.assetId;
    const title = dto.title?.trim() || `${lesson.title} - Video`;

    // Automatically register upload into teacher's MediaAsset library if not already linked
    if (!assetId) {
      const asset = await this.prisma.mediaAsset.create({
        data: {
          uploaderId: teacherId,
          name: title,
          fileUrl: dto.videoUrl.trim(),
          fileType: "video/mp4",
          durationSeconds: dto.durationSeconds,
          contentHash: dto.contentHash?.toLowerCase().trim() || null,
          source: "R2_UPLOAD",
          mediaType: "VIDEO",
        },
      });
      assetId = asset.id;
    }

    const upserted = await this.prisma.video.upsert({
      where: { lessonId },
      create: {
        lessonId,
        assetId,
        videoUrl: dto.videoUrl.trim(),
        durationSeconds: dto.durationSeconds,
        title,
        isExternal: false,
      },
      update: {
        assetId,
        videoUrl: dto.videoUrl.trim(),
        durationSeconds: dto.durationSeconds,
        ...(dto.title ? { title: dto.title.trim() } : {}),
        isExternal: false,
      },
    });

    await this.invalidateCache();
    return upserted;
  }

  async attachVideoFromLibrary(
    lessonId: string,
    dto: AttachVideoFromLibraryDto,
    user: { id: string; role: Role },
  ) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
    });

    if (!lesson) {
      throw new NotFoundException("Lesson not found");
    }

    const asset = await this.prisma.mediaAsset.findUnique({
      where: { id: dto.assetId },
    });

    if (!asset) {
      throw new NotFoundException("Media asset not found in library");
    }

    if (asset.mediaType !== "VIDEO") {
      throw new BadRequestException("The selected media asset is not a video");
    }

    // Ensure teacher owns this asset or user is Admin
    if (user.role !== Role.ADMIN && asset.uploaderId !== user.id) {
      throw new ForbiddenException("You can only attach video assets from your own library");
    }

    const title = dto.customTitle?.trim() || asset.name;
    const durationSeconds = asset.durationSeconds || 0;

    const upserted = await this.prisma.video.upsert({
      where: { lessonId },
      create: {
        lessonId,
        assetId: asset.id,
        videoUrl: asset.fileUrl,
        durationSeconds,
        title,
        isExternal: asset.source === "EXTERNAL_URL",
      },
      update: {
        assetId: asset.id,
        videoUrl: asset.fileUrl,
        durationSeconds,
        title,
        isExternal: asset.source === "EXTERNAL_URL",
      },
    });

    await this.invalidateCache();
    return upserted;
  }
}
