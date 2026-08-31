import {
  Inject,
  Injectable,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class CourseOwnershipGuard implements CanActivate {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException("Unauthenticated user");
    }

    // Admins bypass resource ownership checks [03_Role_and_Permission_Matrix]
    if (user.role === "ADMIN") {
      return true;
    }

    const params = request.params || {};
    const path: string = request.route?.path || request.url || "";

    let teacherId: string | null = null;
    let resolvedCourse: { id: string; teacherId: string } | null = null;

    if (params.courseId) {
      const course = await this.prisma.course.findUnique({
        where: { id: params.courseId },
        select: { id: true, teacherId: true },
      });
      if (!course) throw new NotFoundException("Course not found");
      teacherId = course.teacherId;
      resolvedCourse = course;
    } else if (params.chapterId) {
      const chapter = await this.prisma.chapter.findUnique({
        where: { id: params.chapterId },
        select: {
          id: true,
          course: { select: { id: true, teacherId: true } },
        },
      });
      if (!chapter) throw new NotFoundException("Chapter not found");
      teacherId = chapter.course.teacherId;
      resolvedCourse = chapter.course;
    } else if (params.id) {
      // Determine entity type based on route path
      if (path.includes("/chapters")) {
        const chapter = await this.prisma.chapter.findUnique({
          where: { id: params.id },
          select: {
            id: true,
            course: { select: { id: true, teacherId: true } },
          },
        });
        if (!chapter) throw new NotFoundException("Chapter not found");
        teacherId = chapter.course.teacherId;
        resolvedCourse = chapter.course;
      } else if (path.includes("/lessons")) {
        const lesson = await this.prisma.lesson.findUnique({
          where: { id: params.id },
          select: {
            id: true,
            chapter: {
              select: { course: { select: { id: true, teacherId: true } } },
            },
          },
        });
        if (!lesson) throw new NotFoundException("Lesson not found");
        teacherId = lesson.chapter.course.teacherId;
        resolvedCourse = lesson.chapter.course;
      } else if (path.includes("/resources")) {
        const resource = await this.prisma.resource.findUnique({
          where: { id: params.id },
          select: {
            id: true,
            lesson: {
              select: {
                chapter: {
                  select: { course: { select: { id: true, teacherId: true } } },
                },
              },
            },
          },
        });
        if (!resource) throw new NotFoundException("Resource not found");
        teacherId = resource.lesson.chapter.course.teacherId;
        resolvedCourse = resource.lesson.chapter.course;
      } else {
        // Default to course id
        const course = await this.prisma.course.findUnique({
          where: { id: params.id },
          select: { id: true, teacherId: true },
        });
        if (!course) throw new NotFoundException("Course not found");
        teacherId = course.teacherId;
        resolvedCourse = course;
      }
    }

    if (teacherId && teacherId !== user.id) {
      throw new ForbiddenException("You do not own this course");
    }

    if (resolvedCourse) {
      request.course = resolvedCourse;
    }

    return true;
  }
}
