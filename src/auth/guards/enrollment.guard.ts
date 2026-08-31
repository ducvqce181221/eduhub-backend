import {
  Inject,
  Injectable,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { EnrollmentStatus, Role } from "../../generated/prisma/client";

@Injectable()
export class EnrollmentGuard implements CanActivate {
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

    // Admins bypass resource ownership and enrollment checks [03_Role_and_Permission_Matrix]
    if (user.role === Role.ADMIN || user.role === "ADMIN") {
      return true;
    }

    const params = request.params || {};
    const path: string = request.route?.path || request.url || "";

    let resolvedCourse: { id: string; teacherId: string } | null = null;

    if (params.courseId) {
      const course = await this.prisma.course.findUnique({
        where: { id: params.courseId },
        select: { id: true, teacherId: true },
      });
      if (!course) {
        throw new NotFoundException("Course not found");
      }
      resolvedCourse = course;
    } else if (params.lessonId) {
      const lesson = await this.prisma.lesson.findUnique({
        where: { id: params.lessonId },
        select: {
          id: true,
          chapter: {
            select: {
              course: { select: { id: true, teacherId: true } },
            },
          },
        },
      });
      if (!lesson) {
        throw new NotFoundException("Lesson not found");
      }
      resolvedCourse = lesson.chapter.course;
    } else if (params.id) {
      if (path.includes("/lessons")) {
        const lesson = await this.prisma.lesson.findUnique({
          where: { id: params.id },
          select: {
            id: true,
            chapter: {
              select: {
                course: { select: { id: true, teacherId: true } },
              },
            },
          },
        });
        if (!lesson) {
          throw new NotFoundException("Lesson not found");
        }
        resolvedCourse = lesson.chapter.course;
      } else {
        const course = await this.prisma.course.findUnique({
          where: { id: params.id },
          select: { id: true, teacherId: true },
        });
        if (!course) {
          throw new NotFoundException("Course not found");
        }
        resolvedCourse = course;
      }
    } else {
      throw new NotFoundException("Resource not found");
    }

    // Teachers can access content for their owned courses without enrolling
    if (user.role === Role.TEACHER || user.role === "TEACHER") {
      if (resolvedCourse.teacherId === user.id) {
        return true;
      }
      throw new ForbiddenException(
        "You do not have permission to access content for this course",
      );
    }

    // Students must have an active or completed enrollment [BR-ENR-01, 03_Role_and_Permission_Matrix]
    if (user.role === Role.STUDENT || user.role === "STUDENT") {
      const enrollment = await this.prisma.enrollment.findUnique({
        where: {
          studentId_courseId: {
            studentId: user.id,
            courseId: resolvedCourse.id,
          },
        },
      });

      if (
        enrollment &&
        (enrollment.status === EnrollmentStatus.ACTIVE ||
          enrollment.status === EnrollmentStatus.COMPLETED)
      ) {
        return true;
      }

      throw new ForbiddenException(
        "You must be enrolled in this course to access this content",
      );
    }

    throw new ForbiddenException("Unauthorized access");
  }
}
