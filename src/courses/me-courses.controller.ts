import { Controller, Get, Inject, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { CoursesService } from "./courses.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { Role } from "../generated/prisma/client";

@ApiTags("Course Management")
@Controller("me")
export class MeCoursesController {
  constructor(
    @Inject(CoursesService)
    private readonly coursesService: CoursesService,
  ) {}

  @Get("courses")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      "List all courses owned by current teacher across all statuses (DRAFT, PUBLISHED, ARCHIVED)",
  })
  @ApiResponse({ status: 200, description: "List of owned courses" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden - Teacher/Admin role required" })
  async getMyCourses(@Req() req: Request) {
    return this.coursesService.findMyCourses(req.user!.id);
  }
}
