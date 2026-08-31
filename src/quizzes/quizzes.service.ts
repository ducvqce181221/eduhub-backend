import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { EnrollmentStatus, Role } from "../generated/prisma/client";
import { CreateQuizDto } from "./dto/create-quiz.dto";
import { UpdateQuizDto } from "./dto/update-quiz.dto";
import { CreateQuestionDto } from "./dto/create-question.dto";
import { UpdateQuestionDto } from "./dto/update-question.dto";
import { SubmitQuizAttemptDto } from "./dto/submit-quiz-attempt.dto";

@Injectable()
export class QuizzesService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Create Quiz for lesson [BR-QZ-01, BR-QZ-02]
   */
  async createQuiz(
    userId: string,
    userRole: Role | string,
    lessonId: string,
    dto: CreateQuizDto,
  ) {
    if (!lessonId) {
      throw new BadRequestException("lessonId is required");
    }

    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        chapter: {
          include: {
            course: { select: { id: true, teacherId: true } },
          },
        },
      },
    });

    if (!lesson) {
      throw new NotFoundException("Lesson not found");
    }

    if (
      userRole !== Role.ADMIN &&
      userRole !== "ADMIN" &&
      lesson.chapter.course.teacherId !== userId
    ) {
      throw new ForbiddenException("You do not own this course");
    }

    // BR-QZ-02: Validate passScore percentage (1-100)
    const passScore = dto.passScore ?? 80;
    if (passScore < 1 || passScore > 100) {
      throw new BadRequestException(
        "passScore must be between 1 and 100 [BR-QZ-02]",
      );
    }

    // BR-QZ-01: Single quiz constraint per lesson
    const existingQuiz = await this.prisma.quiz.findUnique({
      where: { lessonId },
    });

    if (existingQuiz) {
      throw new ConflictException(
        "A quiz already exists for this lesson [BR-QZ-01]",
      );
    }

    return this.prisma.quiz.create({
      data: {
        lessonId,
        title: dto.title,
        description: dto.description,
        passScore,
      },
    });
  }

  /**
   * Update Quiz metadata [BR-QZ-02]
   */
  async updateQuiz(
    userId: string,
    userRole: Role | string,
    quizId: string,
    dto: UpdateQuizDto,
  ) {
    const quiz = await this.prisma.quiz.findUnique({
      where: { id: quizId },
      include: {
        lesson: {
          include: {
            chapter: {
              include: {
                course: { select: { id: true, teacherId: true } },
              },
            },
          },
        },
      },
    });

    if (!quiz) {
      throw new NotFoundException("Quiz not found");
    }

    if (
      userRole !== Role.ADMIN &&
      userRole !== "ADMIN" &&
      quiz.lesson.chapter.course.teacherId !== userId
    ) {
      throw new ForbiddenException("You do not own this course");
    }

    if (dto.passScore !== undefined) {
      if (dto.passScore < 1 || dto.passScore > 100) {
        throw new BadRequestException(
          "passScore must be between 1 and 100 [BR-QZ-02]",
        );
      }
    }

    return this.prisma.quiz.update({
      where: { id: quizId },
      data: {
        ...(dto.title ? { title: dto.title } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description }
          : {}),
        ...(dto.passScore !== undefined ? { passScore: dto.passScore } : {}),
      },
    });
  }

  /**
   * Delete Quiz and cascade children
   */
  async deleteQuiz(
    userId: string,
    userRole: Role | string,
    quizId: string,
  ) {
    const quiz = await this.prisma.quiz.findUnique({
      where: { id: quizId },
      include: {
        lesson: {
          include: {
            chapter: {
              include: {
                course: { select: { id: true, teacherId: true } },
              },
            },
          },
        },
      },
    });

    if (!quiz) {
      throw new NotFoundException("Quiz not found");
    }

    if (
      userRole !== Role.ADMIN &&
      userRole !== "ADMIN" &&
      quiz.lesson.chapter.course.teacherId !== userId
    ) {
      throw new ForbiddenException("You do not own this course");
    }

    return this.prisma.quiz.delete({
      where: { id: quizId },
    });
  }

  /**
   * Add Single-Choice Question with Answers [BR-QZ-03]
   */
  async addQuestion(
    userId: string,
    userRole: Role | string,
    quizId: string,
    dto: CreateQuestionDto,
  ) {
    const quiz = await this.prisma.quiz.findUnique({
      where: { id: quizId },
      include: {
        lesson: {
          include: {
            chapter: {
              include: {
                course: { select: { id: true, teacherId: true } },
              },
            },
          },
        },
      },
    });

    if (!quiz) {
      throw new NotFoundException("Quiz not found");
    }

    if (
      userRole !== Role.ADMIN &&
      userRole !== "ADMIN" &&
      quiz.lesson.chapter.course.teacherId !== userId
    ) {
      throw new ForbiddenException("You do not own this course");
    }

    // BR-QZ-03: Validate points >= 1
    const points = dto.points ?? 1;
    if (points < 1) {
      throw new BadRequestException("Question points must be at least 1 [BR-QZ-03]");
    }

    // BR-QZ-03: Validate answers >= 2 and exactly 1 correct answer
    if (!dto.answers || dto.answers.length < 2) {
      throw new BadRequestException(
        "A question must contain at least 2 answers [BR-QZ-03]",
      );
    }

    const correctAnswers = dto.answers.filter((a) => a.isCorrect === true);
    if (correctAnswers.length !== 1) {
      throw new BadRequestException(
        "A single-choice question must have exactly 1 correct answer [BR-QZ-03]",
      );
    }

    // Determine sequential order
    let order = dto.order;
    if (!order) {
      const maxOrder = await this.prisma.question.aggregate({
        where: { quizId },
        _max: { order: true },
      });
      order = (maxOrder._max.order ?? 0) + 1;
    }

    return this.prisma.$transaction(async (tx) => {
      const question = await tx.question.create({
        data: {
          quizId,
          content: dto.content,
          order,
          points,
          answers: {
            create: dto.answers.map((a) => ({
              content: a.content,
              isCorrect: a.isCorrect,
            })),
          },
        },
        include: {
          answers: true,
        },
      });

      return question;
    });
  }

  /**
   * Update Question and replace Answers atomically [BR-QZ-03]
   */
  async updateQuestion(
    userId: string,
    userRole: Role | string,
    questionId: string,
    dto: UpdateQuestionDto,
  ) {
    const question = await this.prisma.question.findUnique({
      where: { id: questionId },
      include: {
        quiz: {
          include: {
            lesson: {
              include: {
                chapter: {
                  include: {
                    course: { select: { id: true, teacherId: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!question) {
      throw new NotFoundException("Question not found");
    }

    if (
      userRole !== Role.ADMIN &&
      userRole !== "ADMIN" &&
      question.quiz.lesson.chapter.course.teacherId !== userId
    ) {
      throw new ForbiddenException("You do not own this course");
    }

    if (dto.points !== undefined && dto.points < 1) {
      throw new BadRequestException("Question points must be at least 1 [BR-QZ-03]");
    }

    if (dto.answers) {
      if (dto.answers.length < 2) {
        throw new BadRequestException(
          "A question must contain at least 2 answers [BR-QZ-03]",
        );
      }
      const correctCount = dto.answers.filter((a) => a.isCorrect === true).length;
      if (correctCount !== 1) {
        throw new BadRequestException(
          "A single-choice question must have exactly 1 correct answer [BR-QZ-03]",
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.answers) {
        await tx.answer.deleteMany({
          where: { questionId },
        });
      }

      const updated = await tx.question.update({
        where: { id: questionId },
        data: {
          ...(dto.content ? { content: dto.content } : {}),
          ...(dto.points !== undefined ? { points: dto.points } : {}),
          ...(dto.order !== undefined ? { order: dto.order } : {}),
          ...(dto.answers
            ? {
                answers: {
                  create: dto.answers.map((a) => ({
                    content: a.content,
                    isCorrect: a.isCorrect,
                  })),
                },
              }
            : {}),
        },
        include: {
          answers: true,
        },
      });

      return updated;
    });
  }

  /**
   * Delete Question and cascading answers
   */
  async deleteQuestion(
    userId: string,
    userRole: Role | string,
    questionId: string,
  ) {
    const question = await this.prisma.question.findUnique({
      where: { id: questionId },
      include: {
        quiz: {
          include: {
            lesson: {
              include: {
                chapter: {
                  include: {
                    course: { select: { id: true, teacherId: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!question) {
      throw new NotFoundException("Question not found");
    }

    if (
      userRole !== Role.ADMIN &&
      userRole !== "ADMIN" &&
      question.quiz.lesson.chapter.course.teacherId !== userId
    ) {
      throw new ForbiddenException("You do not own this course");
    }

    return this.prisma.question.delete({
      where: { id: questionId },
    });
  }

  /**
   * Find Quiz with Question and Answer details [BR-QZ-06]
   * Strictly masks `isCorrect` on answers when viewed by STUDENT.
   */
  async findOneQuiz(
    userId: string,
    userRole: Role | string,
    quizId: string,
  ) {
    const quiz = await this.prisma.quiz.findUnique({
      where: { id: quizId },
      include: {
        lesson: {
          include: {
            chapter: {
              include: {
                course: { select: { id: true, teacherId: true } },
              },
            },
          },
        },
        questions: {
          orderBy: { order: "asc" },
          include: {
            answers: {
              orderBy: { id: "asc" },
            },
          },
        },
      },
    });

    if (!quiz) {
      throw new NotFoundException("Quiz not found");
    }

    const courseId = quiz.lesson.chapter.course.id;
    const teacherId = quiz.lesson.chapter.course.teacherId;

    if (userRole === Role.ADMIN || userRole === "ADMIN") {
      // Admin sees everything including isCorrect
      return quiz;
    }

    if (userRole === Role.TEACHER || userRole === "TEACHER") {
      if (teacherId !== userId) {
        throw new ForbiddenException("You do not own this course");
      }
      return quiz;
    }

    // Role is STUDENT: Must verify active or completed enrollment
    const enrollment = await this.prisma.enrollment.findUnique({
      where: {
        studentId_courseId: {
          studentId: userId,
          courseId,
        },
      },
    });

    if (!enrollment || enrollment.status === EnrollmentStatus.CANCELLED) {
      throw new ForbiddenException(
        "You must be enrolled in this course to view the quiz",
      );
    }

    // BR-QZ-06: Mask isCorrect on answers for Student
    return {
      id: quiz.id,
      lessonId: quiz.lessonId,
      title: quiz.title,
      description: quiz.description,
      passScore: quiz.passScore,
      createdAt: quiz.createdAt,
      updatedAt: quiz.updatedAt,
      questions: quiz.questions.map((q) => ({
        id: q.id,
        quizId: q.quizId,
        content: q.content,
        order: q.order,
        points: q.points,
        createdAt: q.createdAt,
        updatedAt: q.updatedAt,
        answers: q.answers.map(({ isCorrect, ...rest }) => rest),
      })),
    };
  }

  /**
   * Submit Quiz Attempt & Atomic Server-Side Grading [BR-QZ-04, BR-QZ-05]
   */
  async submitQuizAttempt(
    studentId: string,
    quizId: string,
    dto: SubmitQuizAttemptDto,
  ) {
    const quiz = await this.prisma.quiz.findUnique({
      where: { id: quizId },
      include: {
        lesson: {
          include: {
            video: true,
            chapter: {
              include: {
                course: { select: { id: true } },
              },
            },
          },
        },
        questions: {
          include: {
            answers: true,
          },
        },
      },
    });

    if (!quiz) {
      throw new NotFoundException("Quiz not found");
    }

    const courseId = quiz.lesson.chapter.course.id;

    // Verify enrollment
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
        "You must be enrolled in this course to submit a quiz attempt",
      );
    }

    // 1. Calculate points
    const totalPoints = quiz.questions.reduce((sum, q) => sum + q.points, 0);
    let earnedPoints = 0;

    const answerMap = new Map<string, string>();
    for (const ans of dto.answers || []) {
      answerMap.set(ans.questionId, ans.selectedAnswerId);
    }

    const attemptAnswersData: {
      questionId: string;
      selectedAnswerId: string;
      isCorrect: boolean;
    }[] = [];

    for (const question of quiz.questions) {
      const selectedAnswerId = answerMap.get(question.id);
      if (selectedAnswerId) {
        const matchingAnswer = question.answers.find(
          (a) => a.id === selectedAnswerId,
        );
        const isCorrect = matchingAnswer?.isCorrect === true;
        if (isCorrect) {
          earnedPoints += question.points;
        }
        attemptAnswersData.push({
          questionId: question.id,
          selectedAnswerId,
          isCorrect,
        });
      }
    }

    const score =
      totalPoints > 0
        ? parseFloat(((earnedPoints / totalPoints) * 100).toFixed(2))
        : 0;

    const isPassed = score >= quiz.passScore;
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      // 2. Create QuizAttempt & QuizAttemptAnswers
      const attempt = await tx.quizAttempt.create({
        data: {
          quizId,
          studentId,
          score,
          isPassed,
          startedAt: now,
          submittedAt: now,
          answers: {
            create: attemptAnswersData,
          },
        },
      });

      // 3. Check if this passing attempt completes the lesson [BR-PRG-02]
      let isLessonCompleted = false;
      if (isPassed) {
        const lesson = quiz.lesson;
        const durationSeconds = lesson.video?.durationSeconds ?? 0;

        const progress = await tx.lessonProgress.findUnique({
          where: {
            studentId_lessonId: {
              studentId,
              lessonId: lesson.id,
            },
          },
        });

        const watchedSeconds = progress?.watchedSeconds ?? 0;
        const isVideoSatisfied =
          durationSeconds > 0
            ? watchedSeconds >= 0.9 * durationSeconds
            : true;

        if (isVideoSatisfied) {
          isLessonCompleted = true;
          await tx.lessonProgress.upsert({
            where: {
              studentId_lessonId: {
                studentId,
                lessonId: lesson.id,
              },
            },
            create: {
              studentId,
              lessonId: lesson.id,
              watchedSeconds,
              isCompleted: true,
              completedAt: now,
            },
            update: {
              isCompleted: true,
              completedAt: progress?.completedAt ?? now,
            },
          });

          // Check if course is 100% completed [BR-PRG-03]
          const allLessons = await tx.lesson.findMany({
            where: {
              chapter: {
                courseId,
              },
            },
            select: { id: true },
          });

          const completedCount = await tx.lessonProgress.count({
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

          if (
            allLessons.length > 0 &&
            completedCount >= allLessons.length &&
            enrollment.status !== EnrollmentStatus.COMPLETED
          ) {
            await tx.enrollment.update({
              where: {
                studentId_courseId: {
                  studentId,
                  courseId,
                },
              },
              data: {
                status: EnrollmentStatus.COMPLETED,
                completedAt: now,
              },
            });
          }
        }
      }

      return {
        attemptId: attempt.id,
        quizId,
        earnedPoints,
        totalPoints,
        score,
        passScore: quiz.passScore,
        isPassed,
        isLessonCompleted,
        submittedAt: attempt.submittedAt,
      };
    });
  }

  /**
   * Get Quiz Attempt History for Current Student [BR-QZ-04]
   */
  async getQuizAttempts(studentId: string, quizId: string) {
    const quiz = await this.prisma.quiz.findUnique({
      where: { id: quizId },
      include: {
        lesson: {
          include: {
            chapter: {
              include: {
                course: { select: { id: true } },
              },
            },
          },
        },
        questions: {
          include: {
            answers: true,
          },
        },
      },
    });

    if (!quiz) {
      throw new NotFoundException("Quiz not found");
    }

    const courseId = quiz.lesson.chapter.course.id;

    // Verify enrollment
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
        "You must be enrolled in this course to view quiz attempts",
      );
    }

    const totalPoints = quiz.questions.reduce((sum, q) => sum + q.points, 0);

    const attempts = await this.prisma.quizAttempt.findMany({
      where: {
        quizId,
        studentId,
      },
      orderBy: { submittedAt: "desc" },
      include: {
        answers: true,
      },
    });

    return attempts.map((attempt) => {
      // Calculate earnedPoints from attempt answers
      const earnedPoints = attempt.answers.reduce((sum, a) => {
        if (a.isCorrect) {
          const q = quiz.questions.find((quest) => quest.id === a.questionId);
          return sum + (q?.points ?? 0);
        }
        return sum;
      }, 0);

      return {
        id: attempt.id,
        score: attempt.score,
        passScore: quiz.passScore,
        isPassed: attempt.isPassed,
        earnedPoints,
        totalPoints,
        startedAt: attempt.startedAt,
        submittedAt: attempt.submittedAt,
      };
    });
  }

  /**
   * Get Aggregated Student Quiz Results for Course [TEACHER/ADMIN]
   */
  async getCourseQuizResults(
    userId: string,
    userRole: Role | string,
    courseId: string,
  ) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, teacherId: true },
    });

    if (!course) {
      throw new NotFoundException("Course not found");
    }

    if (
      userRole !== Role.ADMIN &&
      userRole !== "ADMIN" &&
      course.teacherId !== userId
    ) {
      throw new ForbiddenException("You do not own this course");
    }

    const attempts = await this.prisma.quizAttempt.findMany({
      where: {
        quiz: {
          lesson: {
            chapter: {
              courseId,
            },
          },
        },
      },
      include: {
        student: {
          select: { id: true, fullName: true, email: true },
        },
        quiz: {
          select: { id: true, title: true, passScore: true },
        },
      },
      orderBy: { submittedAt: "desc" },
    });

    const map = new Map<
      string,
      {
        studentId: string;
        fullName: string;
        email: string;
        quizId: string;
        quizTitle: string;
        attemptsCount: number;
        highestScore: number;
        isPassed: boolean;
        latestSubmittedAt: Date;
      }
    >();

    for (const attempt of attempts) {
      const key = `${attempt.studentId}_${attempt.quizId}`;
      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          studentId: attempt.studentId,
          fullName: attempt.student.fullName,
          email: attempt.student.email,
          quizId: attempt.quizId,
          quizTitle: attempt.quiz.title,
          attemptsCount: 1,
          highestScore: attempt.score,
          isPassed: attempt.isPassed,
          latestSubmittedAt: attempt.submittedAt,
        });
      } else {
        existing.attemptsCount += 1;
        existing.highestScore = Math.max(existing.highestScore, attempt.score);
        existing.isPassed = existing.isPassed || attempt.isPassed;
        if (attempt.submittedAt > existing.latestSubmittedAt) {
          existing.latestSubmittedAt = attempt.submittedAt;
        }
      }
    }

    return Array.from(map.values());
  }
}
