import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
  UnprocessableEntityException,
} from "@nestjs/common";
import { createHash } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { RedisCacheService } from "../common/cache/redis-cache.service";
import { CACHE_CONSTANTS } from "../common/cache/cache.constants";
import { CreateCourseDto } from "./dto/create-course.dto";
import { UpdateCourseDto } from "./dto/update-course.dto";
import { QueryCoursesDto } from "./dto/query-courses.dto";
import { generateCourseSlug } from "../common/utils/slug.util";
import { validateCoursePublish } from "./course-publish.validator";
import { CourseStatus, EnrollmentStatus, Role } from "../generated/prisma/client";
import { R2StorageService } from "../upload/r2-storage.service";

@Injectable()
export class CoursesService {
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

  private generateCacheKey(query: QueryCoursesDto): string {
    const normalized = {
      page: Number(query.page) || 1,
      limit: Number(query.limit) || 10,
      categoryId: query.categoryId || "",
      level: query.level || "",
      search: query.search?.trim().toLowerCase() || "",
      sort: (query as any).sort || "newest",
      status: query.status || "",
    };
    const hash = createHash("md5").update(JSON.stringify(normalized)).digest("hex");
    return `${CACHE_CONSTANTS.COURSES_LIST_PREFIX}${hash}`;
  }

  private async invalidateCache(): Promise<void> {
    if (this.cacheService) {
      await this.cacheService.delByPattern(CACHE_CONSTANTS.COURSES_LIST_PATTERN);
    }
  }

  async create(teacherId: string, dto: CreateCourseDto) {
    if (!dto || !dto.title || !dto.categoryId) {
      throw new BadRequestException("Title and categoryId are required");
    }

    // Verify category exists and is active [BR-CRS-01, BR-CAT-03]
    const category = await this.prisma.category.findUnique({
      where: { id: dto.categoryId },
    });

    if (!category) {
      throw new NotFoundException("Category not found");
    }

    if (!category.isActive) {
      throw new BadRequestException("Selected category is not active");
    }

    const slug = generateCourseSlug(dto.title);

    const course = await this.prisma.course.create({
      data: {
        title: dto.title.trim(),
        slug,
        categoryId: dto.categoryId,
        teacherId,
        description: dto.description?.trim(),
        thumbnailUrl: dto.thumbnailUrl?.trim(),
        level: dto.level || "BEGINNER",
        status: CourseStatus.DRAFT,
        publishedAt: null,
      },
      include: {
        category: true,
        teacher: {
          select: {
            id: true,
            fullName: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });

    await this.invalidateCache();
    return course;
  }

  async findAll(query: QueryCoursesDto) {
    const cacheKey = this.generateCacheKey(query);
    if (this.cacheService) {
      const cached = await this.cacheService.get<{ items: any[]; meta: any }>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Number(query.limit) || 10);
    const skip = (page - 1) * limit;

    const whereClause: any = {};

    if (query.status && query.status !== "ALL") {
      whereClause.status = query.status as CourseStatus;
    } else if (!query.status) {
      whereClause.status = CourseStatus.PUBLISHED;
    }

    if (query.categoryId) {
      whereClause.categoryId = query.categoryId;
    }

    if (query.level) {
      whereClause.level = query.level;
    }

    if (query.search && query.search.trim().length > 0) {
      const search = query.search.trim();
      whereClause.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    const [total, courses] = await Promise.all([
      this.prisma.course.count({ where: whereClause }),
      this.prisma.course.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          category: true,
          teacher: {
            select: {
              id: true,
              fullName: true,
              email: true,
              avatarUrl: true,
            },
          },
          _count: {
            select: {
              chapters: true,
              enrollments: true,
            },
          },
        },
      }),
    ]);

    const result = {
      items: courses,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };

    if (this.cacheService) {
      await this.cacheService.set(
        cacheKey,
        result,
        CACHE_CONSTANTS.COURSES_CACHE_TTL_SECONDS,
      );
    }

    return result;
  }

  async findMyCourses(teacherId: string) {
    return this.prisma.course.findMany({
      where: { teacherId },
      orderBy: { updatedAt: "desc" },
      include: {
        category: true,
        _count: {
          select: {
            chapters: true,
            enrollments: true,
          },
        },
      },
    });
  }

  async findOne(id: string, user?: { id: string; role: Role }) {
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id,
      );

    const course = await this.prisma.course.findUnique({
      where: isUuid ? { id } : { slug: id },
      include: {
        category: true,
        teacher: {
          select: {
            id: true,
            fullName: true,
            email: true,
            avatarUrl: true,
          },
        },
        chapters: {
          orderBy: { order: "asc" },
          include: {
            lessons: {
              orderBy: { order: "asc" },
              include: {
                video: true,
                resources: true,
                _count: {
                  select: { resources: true },
                },
              },
            },
          },
        },
      },
    });

    if (!course) {
      throw new NotFoundException("Course not found");
    }

    // If course is not published, only owner or Admin can view details [BR-CRS-03]
    if (course.status !== CourseStatus.PUBLISHED) {
      if (!user || (user.role !== Role.ADMIN && course.teacherId !== user.id)) {
        throw new ForbiddenException(
          "You do not have access to this unpublished course",
        );
      }
    }

    // Check if requester has authorized content manager privilege or active enrollment
    let canAccessContent = false;
    if (user) {
      if (user.role === Role.ADMIN || course.teacherId === user.id) {
        canAccessContent = true;
      } else {
        const enrollment = await this.prisma.enrollment.findUnique({
          where: {
            studentId_courseId: {
              studentId: user.id,
              courseId: course.id,
            },
          },
        });
        if (
          enrollment &&
          (enrollment.status === EnrollmentStatus.ACTIVE ||
            enrollment.status === EnrollmentStatus.COMPLETED)
        ) {
          canAccessContent = true;
        }
      }
    }

    if (!canAccessContent) {
      // Find the first video lesson in the course (lowest chapter order, lowest lesson order)
      let previewLessonId: string | null = null;
      let signedPreviewUrl: string | null = null;

      for (const ch of course.chapters) {
        for (const l of ch.lessons) {
          if (l.video && l.video.videoUrl) {
            previewLessonId = l.id;
            if (this.r2StorageService && !l.video.isExternal) {
              signedPreviewUrl = await this.r2StorageService.generatePresignedGetUrl(
                l.video.videoUrl,
                900,
              );
            } else {
              signedPreviewUrl = l.video.videoUrl;
            }
            break;
          }
        }
        if (previewLessonId) break;
      }

      // Mask raw streaming videoUrl and downloadable fileUrl for un-enrolled / guest visitors,
      // EXCEPT for the single first video lesson which acts as the free preview [BR-CRS-PREVIEW]
      return {
        ...course,
        previewLessonId,
        chapters: course.chapters.map((ch) => ({
          ...ch,
          lessons: ch.lessons.map((l) => {
            const isPreview = l.id === previewLessonId;
            return {
              ...l,
              video: l.video
                ? {
                    id: l.video.id,
                    lessonId: l.video.lessonId,
                    durationSeconds: l.video.durationSeconds,
                    title: l.video.title,
                    isPreview,
                    videoUrl: undefined,
                    playbackUrl: isPreview ? (signedPreviewUrl || undefined) : undefined,
                  }

                : null,
              resources: l.resources.map((r) => ({
                id: r.id,
                lessonId: r.lessonId,
                name: r.name,
                fileType: r.fileType,
                fileSize: r.fileSize,
                isExternal: r.isExternal,
              })),
            };
          }),
        })),
      };
    }

    return course;
  }

  async getPreviewVideo(id: string) {
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id,
      );

    const course = await this.prisma.course.findUnique({
      where: isUuid ? { id } : { slug: id },
      include: {
        chapters: {
          orderBy: { order: "asc" },
          include: {
            lessons: {
              orderBy: { order: "asc" },
              include: { video: true },
            },
          },
        },
      },
    });

    if (!course) {
      throw new NotFoundException("Course not found");
    }

    if (course.status !== CourseStatus.PUBLISHED) {
      throw new ForbiddenException("Cannot preview unpublished course");
    }

    for (const ch of course.chapters) {
      for (const l of ch.lessons) {
        if (l.video && l.video.videoUrl) {
          let videoUrl = l.video.videoUrl;
          if (this.r2StorageService && !l.video.isExternal) {
            videoUrl = await this.r2StorageService.generatePresignedGetUrl(
              l.video.videoUrl,
              900,
            );
          }
          return {
            courseId: course.id,
            courseTitle: course.title,
            courseSlug: course.slug,
            lessonId: l.id,
            lessonTitle: l.title,
            videoUrl,
            previewUrl: videoUrl,
            durationSeconds: l.video.durationSeconds,
            isPreview: true,
          };
        }
      }
    }

    throw new NotFoundException("No preview video available for this course");
  }

  async update(id: string, dto: UpdateCourseDto) {
    const course = await this.prisma.course.findUnique({
      where: { id },
    });

    if (!course) {
      throw new NotFoundException("Course not found");
    }

    const updateData: any = {};

    if (dto.title !== undefined) {
      updateData.title = dto.title.trim();
    }

    if (dto.description !== undefined) {
      updateData.description = dto.description.trim();
    }

    if (dto.thumbnailUrl !== undefined) {
      updateData.thumbnailUrl = dto.thumbnailUrl.trim();
    }

    if (dto.level !== undefined) {
      updateData.level = dto.level;
    }

    if (dto.categoryId !== undefined) {
      // Validate that category is active [BR-CRS-03, BR-CAT-03]
      const category = await this.prisma.category.findUnique({
        where: { id: dto.categoryId },
      });
      if (!category) {
        throw new NotFoundException("Category not found");
      }
      if (!category.isActive) {
        throw new BadRequestException("Target category is not active");
      }
      updateData.categoryId = dto.categoryId;
    }

    const updated = await this.prisma.course.update({
      where: { id },
      data: updateData,
      include: {
        category: true,
      },
    });

    await this.invalidateCache();
    return updated;
  }

  async publish(id: string) {
    const course = await this.prisma.course.findUnique({
      where: { id },
      include: {
        category: true,
        chapters: {
          orderBy: { order: "asc" },
          include: {
            lessons: {
              orderBy: { order: "asc" },
              include: {
                video: true,
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
            },
          },
        },
      },
    });

    if (!course) {
      throw new NotFoundException("Course not found");
    }

    // Validate 5-point Publish-Ready Checklist [BR-CRS-02]
    const validation = validateCoursePublish(course);
    if (!validation.isValid) {
      throw new UnprocessableEntityException({
        message: "Course does not satisfy the 5-point Publish-Ready Checklist",
        errors: validation.errors,
      });
    }

    const published = await this.prisma.course.update({
      where: { id },
      data: {
        status: CourseStatus.PUBLISHED,
        publishedAt: new Date(),
      },
      include: {
        category: true,
      },
    });

    await this.invalidateCache();
    return published;
  }

  async unpublish(id: string) {
    const course = await this.prisma.course.findUnique({
      where: { id },
    });

    if (!course) {
      throw new NotFoundException("Course not found");
    }

    const unpublished = await this.prisma.course.update({
      where: { id },
      data: {
        status: CourseStatus.DRAFT,
      },
    });

    await this.invalidateCache();
    return unpublished;
  }

  async archive(id: string) {
    const course = await this.prisma.course.findUnique({
      where: { id },
    });

    if (!course) {
      throw new NotFoundException("Course not found");
    }

    // ARCHIVED is terminal in MVP; cannot re-archive [BR-CRS-04]
    if (course.status === CourseStatus.ARCHIVED) {
      throw new BadRequestException("Course is already archived");
    }

    const archived = await this.prisma.course.update({
      where: { id },
      data: {
        status: CourseStatus.ARCHIVED,
      },
    });

    await this.invalidateCache();
    return archived;
  }

  /**
   * Compute platform-wide course metrics (Admin only)
   */
  async getPlatformCourseStats() {
    const [statusGroups, total] = await Promise.all([
      this.prisma.course.groupBy({
        by: ["status"],
        _count: {
          _all: true,
        },
      }),
      this.prisma.course.count(),
    ]);

    let published = 0;
    let draft = 0;
    let archived = 0;

    for (const group of statusGroups) {
      if (group.status === CourseStatus.PUBLISHED) published = group._count._all;
      else if (group.status === CourseStatus.DRAFT) draft = group._count._all;
      else if (group.status === CourseStatus.ARCHIVED) archived = group._count._all;
    }

    return {
      total,
      published,
      draft,
      archived,
    };
  }
}
