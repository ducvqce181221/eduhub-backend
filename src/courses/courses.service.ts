import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateCourseDto } from "./dto/create-course.dto";
import { UpdateCourseDto } from "./dto/update-course.dto";
import { QueryCoursesDto } from "./dto/query-courses.dto";
import { generateCourseSlug } from "../common/utils/slug.util";
import { validateCoursePublish } from "./course-publish.validator";
import { CourseStatus, Role } from "../generated/prisma/client";

@Injectable()
export class CoursesService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

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

    return this.prisma.course.create({
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
  }

  async findAll(query: QueryCoursesDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Number(query.limit) || 10);
    const skip = (page - 1) * limit;

    const whereClause: any = {
      status: CourseStatus.PUBLISHED,
    };

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

    return {
      items: courses,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
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
    const course = await this.prisma.course.findUnique({
      where: { id },
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

    return course;
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

    return this.prisma.course.update({
      where: { id },
      data: updateData,
      include: {
        category: true,
      },
    });
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

    return this.prisma.course.update({
      where: { id },
      data: {
        status: CourseStatus.PUBLISHED,
        publishedAt: new Date(),
      },
      include: {
        category: true,
      },
    });
  }

  async unpublish(id: string) {
    const course = await this.prisma.course.findUnique({
      where: { id },
    });

    if (!course) {
      throw new NotFoundException("Course not found");
    }

    return this.prisma.course.update({
      where: { id },
      data: {
        status: CourseStatus.DRAFT,
      },
    });
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

    return this.prisma.course.update({
      where: { id },
      data: {
        status: CourseStatus.ARCHIVED,
      },
    });
  }
}
