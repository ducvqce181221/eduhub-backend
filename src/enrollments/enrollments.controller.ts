import {
  Controller,
  Get,
  Inject,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { EnrollmentsService } from "./enrollments.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/guards/jwt-auth.guard";
import { Role } from "../generated/prisma/client";

@ApiTags("Enrollment & Progress")
@Controller()
export class EnrollmentsController {
  constructor(
    @Inject(EnrollmentsService)
    private readonly enrollmentsService: EnrollmentsService,
  ) {}

  @Post("courses/:courseId/enroll")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.STUDENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Enroll current student in published course" })
  @ApiParam({ name: "courseId", type: String, description: "Course UUID" })
  @ApiResponse({ status: 201, description: "Successfully enrolled in course" })
  @ApiResponse({
    status: 400,
    description: "Course is not published or invalid role [BR-ENR-01]",
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden - Student role required" })
  @ApiResponse({ status: 404, description: "Course not found" })
  @ApiResponse({
    status: 409,
    description: "Duplicate enrollment in this course [BR-ENR-02]",
  })
  async enroll(
    @Param("courseId") courseId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.enrollmentsService.enroll(user.id, user.role, courseId);
  }

  @Get("me/enrollments")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.STUDENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: "List enrolled courses of current student" })
  @ApiResponse({
    status: 200,
    description: "List of student enrollments with course details",
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden - Student role required" })
  async getMyEnrollments(@CurrentUser() user: AuthenticatedUser) {
    return this.enrollmentsService.getMyEnrollments(user.id);
  }
}
