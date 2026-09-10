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

    let resolvedCourse: { id: string; teacherId: string } | null = null;

    if (params.courseId) {
      const course = await this.prisma.course.findUnique({
        where: { id: params.courseId },
        select: { id: true, teacherId: true },
      });
      if (!course) throw new NotFoundException("Course not found");
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
      resolvedCourse = chapter.course;
    } else if (params.lessonId) {
      const lesson = await this.prisma.lesson.findUnique({
        where: { id: params.lessonId },
        select: {
          id: true,
          chapter: {
            select: { course: { select: { id: true, teacherId: true } } },
          },
        },
      });
      if (!lesson) throw new NotFoundException("Lesson not found");
      resolvedCourse = lesson.chapter.course;
    } else if (params.quizId) {
      const quiz = await this.prisma.quiz.findUnique({
        where: { id: params.quizId },
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
      if (!quiz) throw new NotFoundException("Quiz not found");
      resolvedCourse = quiz.lesson.chapter.course;
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
        resolvedCourse = resource.lesson.chapter.course;
      } else if (path.includes("/quizzes")) {
        const quiz = await this.prisma.quiz.findUnique({
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
        if (!quiz) throw new NotFoundException("Quiz not found");
        resolvedCourse = quiz.lesson.chapter.course;
      } else if (path.includes("/questions")) {
        const question = await this.prisma.question.findUnique({
          where: { id: params.id },
          select: {
            id: true,
            quiz: {
              select: {
                lesson: {
                  select: {
                    chapter: {
                      select: { course: { select: { id: true, teacherId: true } } },
                    },
                  },
                },
              },
            },
          },
        });
        if (!question) throw new NotFoundException("Question not found");
        resolvedCourse = question.quiz.lesson.chapter.course;
      } else {
        // Default to course id
        const course = await this.prisma.course.findUnique({
          where: { id: params.id },
          select: { id: true, teacherId: true },
        });
        if (!course) throw new NotFoundException("Course not found");
        resolvedCourse = course;
      }
    }

    if (resolvedCourse) {
      if (resolvedCourse.teacherId !== user.id) {
        throw new ForbiddenException("You do not own this course");
      }
      request.course = resolvedCourse;
    }

    return true;
  }
}
