import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { CoursesService } from "./courses.service";
import { CreateCourseDto } from "./dto/create-course.dto";
import { UpdateCourseDto } from "./dto/update-course.dto";
import { QueryCoursesDto } from "./dto/query-courses.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { OptionalJwtAuthGuard } from "../auth/guards/optional-jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { CourseOwnershipGuard } from "../auth/guards/course-ownership.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { Role } from "../generated/prisma/client";

@ApiTags("Course Management")
@Controller("courses")
export class CoursesController {
  constructor(
    @Inject(CoursesService)
    private readonly coursesService: CoursesService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Create a new draft course" })
  @ApiBody({ type: CreateCourseDto })
  @ApiResponse({ status: 201, description: "Course created successfully" })
  @ApiResponse({ status: 400, description: "Validation error or category inactive" })
  @ApiResponse({ status: 403, description: "Forbidden - Teacher/Admin role required" })
  async create(@Body() dto: CreateCourseDto, @Req() req: Request) {
    return this.coursesService.create(req.user!.id, dto);
  }

  @Get()
  @ApiOperation({
    summary: "Search, filter, and paginate published courses (Public)",
  })
  @ApiResponse({ status: 200, description: "Paginated list of published courses" })
  async findAll(@Query() query: QueryCoursesDto) {
    return this.coursesService.findAll(query);
  }

  @Get("stats")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get overall platform course statistics (Admin only)" })
  @ApiResponse({ status: 200, description: "Platform course statistics" })
  async getStats() {
    return this.coursesService.getPlatformCourseStats();
  }

  @Get(":id")
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: "View course details" })
  @ApiParam({ name: "id", type: String, description: "Course UUID" })
  @ApiResponse({ status: 200, description: "Course details" })
  @ApiResponse({ status: 403, description: "Forbidden - Unpublished course restricted to owner/admin" })
  @ApiResponse({ status: 404, description: "Course not found" })
  async findOne(@Param("id") id: string, @Req() req: Request) {
    return this.coursesService.findOne(
      id,
      req.user ? { id: req.user.id, role: req.user.role as Role } : undefined,
    );
  }

  @Patch(":id")
  @UseGuards(JwtAuthGuard, RolesGuard, CourseOwnershipGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Update course metadata" })
  @ApiParam({ name: "id", type: String, description: "Course UUID" })
  @ApiBody({ type: UpdateCourseDto })
  @ApiResponse({ status: 200, description: "Course updated successfully" })
  @ApiResponse({ status: 400, description: "Validation failure" })
  @ApiResponse({ status: 403, description: "Forbidden - Ownership failed" })
  @ApiResponse({ status: 404, description: "Course not found" })
  async update(@Param("id") id: string, @Body() dto: UpdateCourseDto) {
    return this.coursesService.update(id, dto);
  }

  @Patch(":id/publish")
  @UseGuards(JwtAuthGuard, RolesGuard, CourseOwnershipGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Publish course (Validates 5-point Publish-Ready Checklist)" })
  @ApiParam({ name: "id", type: String, description: "Course UUID" })
  @ApiResponse({ status: 200, description: "Course published successfully" })
  @ApiResponse({
    status: 422,
    description: "Unprocessable Entity - Publish Checklist violations",
  })
  @ApiResponse({ status: 403, description: "Forbidden - Ownership failed" })
  @ApiResponse({ status: 404, description: "Course not found" })
  async publish(@Param("id") id: string) {
    return this.coursesService.publish(id);
  }

  @Patch(":id/unpublish")
  @UseGuards(JwtAuthGuard, RolesGuard, CourseOwnershipGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Revert published course to DRAFT" })
  @ApiParam({ name: "id", type: String, description: "Course UUID" })
  @ApiResponse({ status: 200, description: "Course reverted to draft" })
  @ApiResponse({ status: 403, description: "Forbidden - Ownership failed" })
  @ApiResponse({ status: 404, description: "Course not found" })
  async unpublish(@Param("id") id: string) {
    return this.coursesService.unpublish(id);
  }

  @Patch(":id/archive")
  @UseGuards(JwtAuthGuard, RolesGuard, CourseOwnershipGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Archive course (Terminal state in MVP)" })
  @ApiParam({ name: "id", type: String, description: "Course UUID" })
  @ApiResponse({ status: 200, description: "Course archived successfully" })
  @ApiResponse({ status: 400, description: "Course is already archived" })
  @ApiResponse({ status: 403, description: "Forbidden - Ownership failed" })
  @ApiResponse({ status: 404, description: "Course not found" })
  async archive(@Param("id") id: string) {
    return this.coursesService.archive(id);
  }
}
