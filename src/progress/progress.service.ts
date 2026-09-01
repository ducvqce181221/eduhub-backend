import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { EventPublisherService } from "../common/events/event-publisher.service";
import { EVENTS_CONSTANTS } from "../common/events/events.constants";
import { EnrollmentStatus, Role } from "../generated/prisma/client";
import { UpdateLessonProgressDto } from "./dto/update-lesson-progress.dto";

@Injectable()
export class ProgressService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Optional()
    private readonly eventPublisher?: EventPublisherService,
  ) {}

  /**
   * Update lesson watchedSeconds heartbeat & evaluate auto-completion [BR-PRG-01, BR-PRG-02, BR-PRG-03]
   */
  async updateLessonProgress(
    studentId: string,
    lessonId: string,
    dto: UpdateLessonProgressDto,
  ) {
    if (!dto || typeof dto.watchedSeconds !== "number") {
      throw new BadRequestException(
        "watchedSeconds must be a number [BR-PRG-01]",
      );
    }

    if (dto.watchedSeconds < 0) {
      throw new BadRequestException(
        "watchedSeconds must not be negative [BR-PRG-01]",
      );
    }

    // 1. Fetch Lesson along with its video, attached quiz, quiz attempts, and course
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        video: true,
        quiz: {
          include: {
            quizAttempts: {
              where: {
                studentId,
                isPassed: true,
              },
            },
          },
        },
        chapter: {
          select: {
            courseId: true,
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

    const courseId = lesson.chapter.courseId;

    // 2. Check Enrollment [BR-ENR-01]
    const enrollment = await this.prisma.enrollment.findUnique({
      where: {
        studentId_courseId: {
          studentId,
          courseId,
        },
      },
    });

    if (!enrollment || enrollment.status === EnrollmentStatus.CANCELLED) {
      throw new ForbiddenException(
        "You must be enrolled in this course to update progress [BR-ENR-01]",
      );
    }

    // 3. WatchedSeconds Clamping [BR-PRG-01]
    let actualWatchedSeconds = dto.watchedSeconds;
    const durationSeconds = lesson.video?.durationSeconds ?? 0;

    if (durationSeconds > 0) {
      actualWatchedSeconds = Math.min(dto.watchedSeconds, durationSeconds);
    }

    // 4. Check existing progress record
    const existingProgress = await this.prisma.lessonProgress.findUnique({
      where: {
        studentId_lessonId: {
          studentId,
          lessonId,
        },
      },
    });

    // 5. Evaluate Lesson Completion [BR-PRG-01, BR-PRG-02]
    let isCompleted = existingProgress?.isCompleted ?? false;
    let completedAt = existingProgress?.completedAt ?? null;

    if (!isCompleted) {
      // Condition 1: Video watch threshold >= 90%
      const isVideoSatisfied =
        durationSeconds > 0
          ? actualWatchedSeconds >= 0.9 * durationSeconds
          : true;

      // Condition 2: Quiz requirement (if quiz is attached, must have >= 1 passed attempt)
      const hasQuiz = !!lesson.quiz;
      const isQuizSatisfied = hasQuiz
        ? (lesson.quiz?.quizAttempts.length ?? 0) > 0
        : true;

      if (isVideoSatisfied && isQuizSatisfied) {
        isCompleted = true;
        completedAt = new Date();
      }
    }

    // 6. Save/Upsert LessonProgress
    const progress = await this.prisma.lessonProgress.upsert({
      where: {
        studentId_lessonId: {
          studentId,
          lessonId,
        },
      },
      create: {
        studentId,
        lessonId,
        watchedSeconds: actualWatchedSeconds,
        isCompleted,
        completedAt,
      },
      update: {
        watchedSeconds: actualWatchedSeconds,
        isCompleted,
        completedAt: isCompleted
          ? (existingProgress?.completedAt ?? completedAt)
          : null,
      },
    });

    // 7. Check if Course Reached 100% Completion [BR-PRG-03]
    if (isCompleted && enrollment.status !== EnrollmentStatus.COMPLETED) {
      await this.evaluateAndCompleteCourse(studentId, courseId);
    }

    return progress;
  }

  /**
   * Get student progress for a single lesson [FR-E04, 05_API_Design §2.6]
   */
  async getLessonProgress(studentId: string, lessonId: string) {
    if (!studentId || !lessonId) {
      throw new BadRequestException("studentId and lessonId are required");
    }

    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      select: { id: true },
    });

    if (!lesson) {
      throw new NotFoundException("Lesson not found");
    }

    const progress = await this.prisma.lessonProgress.findUnique({
      where: {
        studentId_lessonId: {
          studentId,
          lessonId,
        },
      },
    });

    if (!progress) {
      return {
        studentId,
        lessonId,
        watchedSeconds: 0,
        isCompleted: false,
        completedAt: null,
      };
    }

    return progress;
  }

  /**
   * Get dynamic course progress for current student [BR-PRG-03, BR-ENR-04, FR-E06]
   */
  async getCourseProgress(studentId: string, courseId: string) {
    if (!studentId || !courseId) {
      throw new BadRequestException("studentId and courseId are required");
    }

    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true },
    });

    if (!course) {
      throw new NotFoundException("Course not found");
    }

    const enrollment = await this.prisma.enrollment.findUnique({
      where: {
        studentId_courseId: {
          studentId,
          courseId,
        },
      },
    });

    if (!enrollment || enrollment.status === EnrollmentStatus.CANCELLED) {
      throw new ForbiddenException(
        "You must be enrolled in this course to view progress [BR-ENR-01]",
      );
    }

    // Dynamic lesson counts
    const totalLessons = await this.prisma.lesson.count({
      where: {
        chapter: {
          courseId,
        },
      },
    });

    const completedProgressRecords = await this.prisma.lessonProgress.findMany({
      where: {
        studentId,
        isCompleted: true,
        lesson: {
          chapter: {
            courseId,
          },
        },
      },
      select: {
        lessonId: true,
      },
    });

    const completedLessonIds = completedProgressRecords.map((r) => r.lessonId);
    const completedLessons = completedLessonIds.length;

    // BR-PRG-03: Defensive Anti-Divide-by-Zero
    const progressPercentage =
      totalLessons > 0
        ? Math.round((completedLessons / totalLessons) * 10000) / 100
        : 0;

    const isCompleted =
      enrollment.status === EnrollmentStatus.COMPLETED ||
      (totalLessons > 0 && completedLessons === totalLessons);

    // If reaching 100% and not yet marked COMPLETED
    if (
      enrollment.status !== EnrollmentStatus.COMPLETED &&
      totalLessons > 0 &&
      completedLessons === totalLessons
    ) {
      await this.prisma.enrollment.update({
        where: {
          studentId_courseId: {
            studentId,
            courseId,
          },
        },
        data: {
          status: EnrollmentStatus.COMPLETED,
          completedAt: new Date(),
        },
      });
      enrollment.status = EnrollmentStatus.COMPLETED;
      enrollment.completedAt = new Date();
    }

    return {
      courseId,
      status: enrollment.status,
      completedLessons,
      totalLessons,
      progressPercentage,
      isCompleted,
      completedLessonIds,
      enrolledAt: enrollment.enrolledAt,
      completedAt: enrollment.completedAt,
    };
  }

  /**
   * Get all enrolled students and their real-time dynamically computed progress [BR-PRG-04, FR-E03]
   */
  async getCourseStudents(
    userId: string,
    userRole: Role | string,
    courseId: string,
  ) {
    if (!userId || !courseId) {
      throw new BadRequestException("userId and courseId are required");
    }

    if (userRole === Role.STUDENT || userRole === "STUDENT") {
      throw new ForbiddenException(
        "Students are not permitted to view course student reports [BR-PRG-04]",
      );
    }

    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, teacherId: true },
    });

    if (!course) {
      throw new NotFoundException("Course not found");
    }

    if (
      (userRole === Role.TEACHER || userRole === "TEACHER") &&
      course.teacherId !== userId
    ) {
      throw new ForbiddenException(
        "You do not have permission to view reports for this course [03_Role_and_Permission_Matrix]",
      );
    }

    const totalLessons = await this.prisma.lesson.count({
      where: {
        chapter: {
          courseId,
        },
      },
    });

    // 1. Fetch all enrollments for this course
    const enrollments = await this.prisma.enrollment.findMany({
      where: { courseId },
      include: {
        student: {
          select: {
            id: true,
            fullName: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { enrolledAt: "asc" },
    });

    // 2. Anti-N+1: Aggregated completed lessons grouped by studentId
    const completedCounts = await this.prisma.lessonProgress.groupBy({
      by: ["studentId"],
      where: {
        isCompleted: true,
        lesson: {
          chapter: {
            courseId,
          },
        },
      },
      _count: {
        lessonId: true,
      },
    });

    const completedMap = new Map<string, number>();
    for (const item of completedCounts) {
      completedMap.set(item.studentId, item._count.lessonId);
    }

    return enrollments.map((enr) => {
      const completedLessons = completedMap.get(enr.studentId) ?? 0;
      const progressPercentage =
        totalLessons > 0
          ? Math.round((completedLessons / totalLessons) * 10000) / 100
          : 0;

      return {
        studentId: enr.student.id,
        fullName: enr.student.fullName,
        email: enr.student.email,
        avatarUrl: enr.student.avatarUrl,
        enrolledAt: enr.enrolledAt,
        completedLessons,
        totalLessons,
        progressPercentage,
        isCompleted:
          enr.status === EnrollmentStatus.COMPLETED ||
          (totalLessons > 0 && completedLessons === totalLessons),
      };
    });
  }

  /**
   * Get aggregate student progress metrics for course [05_API_Design §2.4]
   */
  async getCourseSummaryProgress(
    userId: string,
    userRole: Role | string,
    courseId: string,
  ) {
    const students = await this.getCourseStudents(userId, userRole, courseId);

    const totalLessons = await this.prisma.lesson.count({
      where: {
        chapter: {
          courseId,
        },
      },
    });

    const totalEnrolled = students.length;
    const completedCount = students.filter((s) => s.isCompleted).length;

    const totalProgressSum = students.reduce(
      (sum, s) => sum + s.progressPercentage,
      0,
    );

    const averageProgressPercentage =
      totalEnrolled > 0
        ? Math.round((totalProgressSum / totalEnrolled) * 100) / 100
        : 0;

    return {
      courseId,
      totalLessons,
      totalEnrolled,
      completedCount,
      averageProgressPercentage,
    };
  }

  /**
   * Helper: Check if all lessons in course are completed, update Enrollment.status to COMPLETED if 100% [BR-PRG-03]
   */
  private async evaluateAndCompleteCourse(
    studentId: string,
    courseId: string,
  ): Promise<boolean> {
    const totalLessons = await this.prisma.lesson.count({
      where: {
        chapter: {
          courseId,
        },
      },
    });

    if (totalLessons === 0) {
      return false;
    }

    const completedLessons = await this.prisma.lessonProgress.count({
      where: {
        studentId,
        isCompleted: true,
        lesson: {
          chapter: {
            courseId,
          },
        },
      },
    });

    if (completedLessons === totalLessons) {
      await this.prisma.enrollment.update({
        where: {
          studentId_courseId: {
            studentId,
            courseId,
          },
        },
        data: {
          status: EnrollmentStatus.COMPLETED,
          completedAt: new Date(),
        },
      });

      // BR-NTF-01: Publish course.completed event asynchronously
      if (this.eventPublisher) {
        const course = await this.prisma.course.findUnique({
          where: { id: courseId },
          select: { title: true },
        });

        await this.eventPublisher.publish(
          EVENTS_CONSTANTS.ROUTING_KEYS.COURSE_COMPLETED,
          {
            studentId,
            courseId,
            courseTitle: course?.title || "EduHub Course",
            timestamp: new Date().toISOString(),
          },
        );
      }

      return true;
    }

    return false;
  }

  /**
   * Helper alias for updateLessonProgress
   */
  async updateProgress(
    studentId: string,
    lessonId: string,
    dto: UpdateLessonProgressDto,
  ) {
    return this.updateLessonProgress(studentId, lessonId, dto);
  }
}
