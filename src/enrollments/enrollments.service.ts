import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import {
  CourseStatus,
  EnrollmentStatus,
  Role,
} from "../generated/prisma/client";

@Injectable()
export class EnrollmentsService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Enroll current student in a published course [BR-ENR-01, BR-ENR-02]
   */
  async enroll(
    studentId: string,
    userRole: Role | string,
    courseId: string,
  ) {
    if (!studentId || !courseId) {
      throw new BadRequestException("studentId and courseId are required");
    }

    // BR-ENR-01: Only students can enroll in courses
    if (userRole !== Role.STUDENT && userRole !== "STUDENT") {
      throw new BadRequestException(
        "Only students can enroll in courses [BR-ENR-01]",
      );
    }

    // Check course existence
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      throw new NotFoundException("Course not found");
    }

    // BR-ENR-01: Course must be in PUBLISHED status
    if (course.status !== CourseStatus.PUBLISHED) {
      throw new BadRequestException(
        "Cannot enroll in an unpublished course [BR-ENR-01]",
      );
    }

    // BR-ENR-02: Prevent duplicate enrollments
    const existing = await this.prisma.enrollment.findUnique({
      where: {
        studentId_courseId: {
          studentId,
          courseId,
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        "Student is already enrolled in this course [BR-ENR-02]",
      );
    }

    return this.prisma.enrollment.create({
      data: {
        studentId,
        courseId,
        status: EnrollmentStatus.ACTIVE,
        enrolledAt: new Date(),
      },
      include: {
        course: {
          select: {
            id: true,
            title: true,
            slug: true,
            status: true,
          },
        },
      },
    });
  }

  /**
   * Retrieve all enrolled courses of current student [FR-E02]
   */
  async getMyEnrollments(studentId: string) {
    if (!studentId) {
      throw new BadRequestException("studentId is required");
    }

    return this.prisma.enrollment.findMany({
      where: { studentId },
      include: {
        course: {
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
        },
      },
      orderBy: { enrolledAt: "desc" },
    });
  }
}
