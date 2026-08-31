import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Put,
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
import { ProgressService } from "./progress.service";
import { UpdateLessonProgressDto } from "./dto/update-lesson-progress.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { EnrollmentGuard } from "../auth/guards/enrollment.guard";
import { CourseOwnershipGuard } from "../auth/guards/course-ownership.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/guards/jwt-auth.guard";
import { Role } from "../generated/prisma/client";

@ApiTags("Enrollment & Progress")
@Controller()
export class ProgressController {
  constructor(
    @Inject(ProgressService)
    private readonly progressService: ProgressService,
  ) {}

  @Get("lessons/:lessonId/progress")
  @UseGuards(JwtAuthGuard, EnrollmentGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get current student's progress for specific lesson" })
  @ApiParam({ name: "lessonId", type: String, description: "Lesson UUID" })
  @ApiResponse({
    status: 200,
    description: "Lesson progress retrieved successfully",
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Must be enrolled in the course",
  })
  @ApiResponse({ status: 404, description: "Lesson not found" })
  async getLessonProgress(
    @Param("lessonId") lessonId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.progressService.getLessonProgress(user.id, lessonId);
  }

  @Put("lessons/:lessonId/progress")
  @UseGuards(JwtAuthGuard, RolesGuard, EnrollmentGuard)
  @Roles(Role.STUDENT)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      "Update watchedSeconds heartbeat (clamps to duration, auto-evaluates completion)",
  })
  @ApiParam({ name: "lessonId", type: String, description: "Lesson UUID" })
  @ApiBody({ type: UpdateLessonProgressDto })
  @ApiResponse({
    status: 200,
    description: "Progress updated & completion evaluated successfully",
  })
  @ApiResponse({
    status: 400,
    description: "Invalid input or negative watchedSeconds [BR-PRG-01]",
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Must be enrolled student",
  })
  @ApiResponse({ status: 404, description: "Lesson not found" })
  async updateLessonProgress(
    @Param("lessonId") lessonId: string,
    @Body() dto: UpdateLessonProgressDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.progressService.updateLessonProgress(user.id, lessonId, dto);
  }

  @Get("me/progress/courses/:courseId")
  @UseGuards(JwtAuthGuard, RolesGuard, EnrollmentGuard)
  @Roles(Role.STUDENT)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      "Get overall course progress percentage, completed lesson counts, and completed IDs",
  })
  @ApiParam({ name: "courseId", type: String, description: "Course UUID" })
  @ApiResponse({
    status: 200,
    description: "Course progress retrieved successfully",
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Must be enrolled student",
  })
  @ApiResponse({ status: 404, description: "Course not found" })
  async getCourseProgress(
    @Param("courseId") courseId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.progressService.getCourseProgress(user.id, courseId);
  }

  @Get("courses/:courseId/students")
  @UseGuards(JwtAuthGuard, RolesGuard, CourseOwnershipGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "View enrolled students and real-time computed progress metrics",
  })
  @ApiParam({ name: "courseId", type: String, description: "Course UUID" })
  @ApiResponse({
    status: 200,
    description: "Enrolled students and real-time progress metrics retrieved",
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Must be course owner teacher or admin",
  })
  @ApiResponse({ status: 404, description: "Course not found" })
  async getCourseStudents(
    @Param("courseId") courseId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.progressService.getCourseStudents(user.id, user.role, courseId);
  }

  @Get("courses/:courseId/progress")
  @UseGuards(JwtAuthGuard, RolesGuard, CourseOwnershipGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "View aggregate student progress metrics for course",
  })
  @ApiParam({ name: "courseId", type: String, description: "Course UUID" })
  @ApiResponse({
    status: 200,
    description: "Aggregate course progress metrics retrieved",
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Must be course owner teacher or admin",
  })
  @ApiResponse({ status: 404, description: "Course not found" })
  async getCourseSummaryProgress(
    @Param("courseId") courseId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.progressService.getCourseSummaryProgress(
      user.id,
      user.role,
      courseId,
    );
  }
}
