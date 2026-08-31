import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { QuizzesService } from "./quizzes.service";
import { CreateQuizDto } from "./dto/create-quiz.dto";
import { UpdateQuizDto } from "./dto/update-quiz.dto";
import { CreateQuestionDto } from "./dto/create-question.dto";
import { UpdateQuestionDto } from "./dto/update-question.dto";
import { SubmitQuizAttemptDto } from "./dto/submit-quiz-attempt.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { CourseOwnershipGuard } from "../auth/guards/course-ownership.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/guards/jwt-auth.guard";
import { Role } from "../generated/prisma/client";

@ApiTags("Quiz & Assessment")
@Controller()
export class QuizzesController {
  constructor(
    @Inject(QuizzesService)
    private readonly quizzesService: QuizzesService,
  ) {}

  @Get("quizzes/:id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.STUDENT, Role.TEACHER, Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      "Get quiz details (Answers strictly omit isCorrect for enrolled students per BR-QZ-06)",
  })
  @ApiParam({ name: "id", type: String, description: "Quiz UUID" })
  @ApiResponse({ status: 200, description: "Quiz details retrieved successfully" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Not enrolled or not course owner",
  })
  @ApiResponse({ status: 404, description: "Quiz not found" })
  async findOne(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.quizzesService.findOneQuiz(user.id, user.role, id);
  }

  @Post("lessons/:lessonId/quiz")
  @UseGuards(JwtAuthGuard, RolesGuard, CourseOwnershipGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Create quiz for lesson (0..1 per lesson)" })
  @ApiParam({ name: "lessonId", type: String, description: "Lesson UUID" })
  @ApiBody({ type: CreateQuizDto })
  @ApiResponse({ status: 201, description: "Quiz created successfully" })
  @ApiResponse({
    status: 400,
    description: "Invalid passScore percentage [BR-QZ-02]",
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden - Not course owner" })
  @ApiResponse({ status: 404, description: "Lesson not found" })
  @ApiResponse({
    status: 409,
    description: "A quiz already exists for this lesson [BR-QZ-01]",
  })
  async createQuiz(
    @Param("lessonId") lessonId: string,
    @Body() dto: CreateQuizDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.quizzesService.createQuiz(user.id, user.role, lessonId, dto);
  }

  @Patch("quizzes/:id")
  @UseGuards(JwtAuthGuard, RolesGuard, CourseOwnershipGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Update quiz title, description, or passScore" })
  @ApiParam({ name: "id", type: String, description: "Quiz UUID" })
  @ApiBody({ type: UpdateQuizDto })
  @ApiResponse({ status: 200, description: "Quiz updated successfully" })
  @ApiResponse({ status: 400, description: "Invalid passScore percentage" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden - Not course owner" })
  @ApiResponse({ status: 404, description: "Quiz not found" })
  async updateQuiz(
    @Param("id") id: string,
    @Body() dto: UpdateQuizDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.quizzesService.updateQuiz(user.id, user.role, id, dto);
  }

  @Delete("quizzes/:id")
  @UseGuards(JwtAuthGuard, RolesGuard, CourseOwnershipGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Delete quiz and its questions/answers" })
  @ApiParam({ name: "id", type: String, description: "Quiz UUID" })
  @ApiResponse({ status: 200, description: "Quiz deleted successfully" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden - Not course owner" })
  @ApiResponse({ status: 404, description: "Quiz not found" })
  async deleteQuiz(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.quizzesService.deleteQuiz(user.id, user.role, id);
  }

  @Post("quizzes/:quizId/questions")
  @UseGuards(JwtAuthGuard, RolesGuard, CourseOwnershipGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Add single-choice question with answers (>= 2 answers, 1 correct)",
  })
  @ApiParam({ name: "quizId", type: String, description: "Quiz UUID" })
  @ApiBody({ type: CreateQuestionDto })
  @ApiResponse({ status: 201, description: "Question created successfully" })
  @ApiResponse({
    status: 400,
    description: "Validation failure (points < 1, answers < 2, or invalid isCorrect count)",
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden - Not course owner" })
  @ApiResponse({ status: 404, description: "Quiz not found" })
  async addQuestion(
    @Param("quizId") quizId: string,
    @Body() dto: CreateQuestionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.quizzesService.addQuestion(user.id, user.role, quizId, dto);
  }

  @Patch("questions/:id")
  @UseGuards(JwtAuthGuard, RolesGuard, CourseOwnershipGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Update question content, points, or answers" })
  @ApiParam({ name: "id", type: String, description: "Question UUID" })
  @ApiBody({ type: UpdateQuestionDto })
  @ApiResponse({ status: 200, description: "Question updated successfully" })
  @ApiResponse({ status: 400, description: "Validation failure" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden - Not course owner" })
  @ApiResponse({ status: 404, description: "Question not found" })
  async updateQuestion(
    @Param("id") id: string,
    @Body() dto: UpdateQuestionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.quizzesService.updateQuestion(user.id, user.role, id, dto);
  }

  @Delete("questions/:id")
  @UseGuards(JwtAuthGuard, RolesGuard, CourseOwnershipGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Delete question and its answers" })
  @ApiParam({ name: "id", type: String, description: "Question UUID" })
  @ApiResponse({ status: 200, description: "Question deleted successfully" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden - Not course owner" })
  @ApiResponse({ status: 404, description: "Question not found" })
  async deleteQuestion(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.quizzesService.deleteQuestion(user.id, user.role, id);
  }

  @Post("quizzes/:quizId/attempts")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.STUDENT)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      "Submit quiz attempt (Atomic grading, calculates float score %, records attempt history per BR-QZ-04/05)",
  })
  @ApiParam({ name: "quizId", type: String, description: "Quiz UUID" })
  @ApiBody({ type: SubmitQuizAttemptDto })
  @ApiResponse({
    status: 201,
    description: "Quiz attempt evaluated and recorded successfully",
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Not enrolled in course",
  })
  @ApiResponse({ status: 404, description: "Quiz not found" })
  async submitAttempt(
    @Param("quizId") quizId: string,
    @Body() dto: SubmitQuizAttemptDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.quizzesService.submitQuizAttempt(user.id, quizId, dto);
  }

  @Get("quizzes/:quizId/attempts")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.STUDENT)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      "View list of previous quiz attempt summaries for current student (BR-QZ-04)",
  })
  @ApiParam({ name: "quizId", type: String, description: "Quiz UUID" })
  @ApiResponse({
    status: 200,
    description: "Quiz attempt history retrieved successfully",
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Not enrolled in course",
  })
  @ApiResponse({ status: 404, description: "Quiz not found" })
  async getAttempts(
    @Param("quizId") quizId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.quizzesService.getQuizAttempts(user.id, quizId);
  }

  @Get("courses/:courseId/quiz-results")
  @UseGuards(JwtAuthGuard, RolesGuard, CourseOwnershipGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "View student quiz results for owned course (Teacher / Admin)",
  })
  @ApiParam({ name: "courseId", type: String, description: "Course UUID" })
  @ApiResponse({
    status: 200,
    description: "Course quiz results retrieved successfully",
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Not course owner",
  })
  @ApiResponse({ status: 404, description: "Course not found" })
  async getCourseQuizResults(
    @Param("courseId") courseId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.quizzesService.getCourseQuizResults(user.id, user.role, courseId);
  }
}
