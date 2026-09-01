import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { EventPublisherService } from "../common/events/event-publisher.service";
import { EVENTS_CONSTANTS } from "../common/events/events.constants";
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
    @Optional()
    private readonly eventPublisher?: EventPublisherService,
  ) {}

  /**
   * Enroll current student in a published course [BR-ENR-01, BR-ENR-02, BR-NTF-01]
   */
  async enroll(
    studentId: string,
    userRoleOrCourseId: Role | string,
    maybeCourseId?: string,
  ) {
    const courseId = maybeCourseId || userRoleOrCourseId;
    const userRole = maybeCourseId ? userRoleOrCourseId : Role.STUDENT;

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

    const enrollment = await this.prisma.enrollment.create({
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

    // BR-NTF-01: Publish course.enrolled event asynchronously
    if (this.eventPublisher) {
      await this.eventPublisher.publish(
        EVENTS_CONSTANTS.ROUTING_KEYS.COURSE_ENROLLED,
        {
          studentId,
          courseId,
          courseTitle: course.title,
          timestamp: new Date().toISOString(),
        },
      );
    }

    return enrollment;
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
