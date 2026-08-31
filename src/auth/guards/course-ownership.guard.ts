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

    const courseId = request.params.courseId || request.params.id;
    if (!courseId) {
      return true;
    }

    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, teacherId: true },
    });

    if (!course) {
      throw new NotFoundException("Course not found");
    }

    if (course.teacherId !== user.id) {
      throw new ForbiddenException("You do not own this course");
    }

    request.course = course;
    return true;
  }
}
