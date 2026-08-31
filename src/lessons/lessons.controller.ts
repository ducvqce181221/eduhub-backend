import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Put,
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
import { LessonsService } from "./lessons.service";
import { ResourcesService } from "./resources.service";
import { CreateLessonDto } from "./dto/create-lesson.dto";
import { UpdateLessonDto } from "./dto/update-lesson.dto";
import { ReorderLessonsDto } from "./dto/reorder-lessons.dto";
import { UpsertVideoDto } from "./dto/upsert-video.dto";
import { CreateResourceDto } from "./dto/create-resource.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { CourseOwnershipGuard } from "../auth/guards/course-ownership.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { Role } from "../generated/prisma/client";

@ApiTags("Lesson Management")
@Controller()
export class LessonsController {
  constructor(
    @Inject(LessonsService)
    private readonly lessonsService: LessonsService,
    @Inject(ResourcesService)
    private readonly resourcesService: ResourcesService,
  ) {}

  @Post("chapters/:chapterId/lessons")
  @UseGuards(JwtAuthGuard, RolesGuard, CourseOwnershipGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Create lesson in chapter" })
  @ApiParam({ name: "chapterId", type: String, description: "Chapter UUID" })
  @ApiBody({ type: CreateLessonDto })
  @ApiResponse({ status: 201, description: "Lesson created successfully" })
  @ApiResponse({ status: 400, description: "Validation failure" })
  @ApiResponse({ status: 403, description: "Forbidden - Course ownership failed" })
  @ApiResponse({ status: 404, description: "Chapter not found" })
  async create(
    @Param("chapterId") chapterId: string,
    @Body() dto: CreateLessonDto,
  ) {
    return this.lessonsService.create(chapterId, dto);
  }

  @Patch("chapters/:chapterId/lessons/reorder")
  @UseGuards(JwtAuthGuard, RolesGuard, CourseOwnershipGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Batch reorder lessons in chapter" })
  @ApiParam({ name: "chapterId", type: String, description: "Chapter UUID" })
  @ApiBody({ type: ReorderLessonsDto })
  @ApiResponse({ status: 200, description: "Lessons reordered successfully" })
  @ApiResponse({ status: 400, description: "Validation error or ID mismatch" })
  @ApiResponse({ status: 403, description: "Forbidden - Course ownership failed" })
  @ApiResponse({ status: 404, description: "Chapter not found" })
  async reorder(
    @Param("chapterId") chapterId: string,
    @Body() dto: ReorderLessonsDto,
  ) {
    return this.lessonsService.reorder(chapterId, dto.orders);
  }

  @Get("lessons/:id")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      "View lesson details & content (Masks isCorrect for Students)",
  })
  @ApiParam({ name: "id", type: String, description: "Lesson UUID" })
  @ApiResponse({ status: 200, description: "Lesson details and contents" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 404, description: "Lesson not found" })
  async findOne(@Param("id") id: string, @Req() req: Request) {
    return this.lessonsService.findOne(id, req.user);
  }

  @Patch("lessons/:id")
  @UseGuards(JwtAuthGuard, RolesGuard, CourseOwnershipGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Update lesson title/description" })
  @ApiParam({ name: "id", type: String, description: "Lesson UUID" })
  @ApiBody({ type: UpdateLessonDto })
  @ApiResponse({ status: 200, description: "Lesson updated successfully" })
  @ApiResponse({ status: 403, description: "Forbidden - Course ownership failed" })
  @ApiResponse({ status: 404, description: "Lesson not found" })
  async update(@Param("id") id: string, @Body() dto: UpdateLessonDto) {
    return this.lessonsService.update(id, dto);
  }

  @Delete("lessons/:id")
  @UseGuards(JwtAuthGuard, RolesGuard, CourseOwnershipGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      "Delete lesson and media (Blocked if last lesson of chapter in published course)",
  })
  @ApiParam({ name: "id", type: String, description: "Lesson UUID" })
  @ApiResponse({ status: 200, description: "Lesson deleted successfully" })
  @ApiResponse({
    status: 400,
    description: "Bad Request - Cannot delete last lesson of published course chapter",
  })
  @ApiResponse({ status: 403, description: "Forbidden - Course ownership failed" })
  @ApiResponse({ status: 404, description: "Lesson not found" })
  async remove(@Param("id") id: string) {
    return this.lessonsService.remove(id);
  }

  @Put("lessons/:id/video")
  @UseGuards(JwtAuthGuard, RolesGuard, CourseOwnershipGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Upsert required video metadata for lesson" })
  @ApiParam({ name: "id", type: String, description: "Lesson UUID" })
  @ApiBody({ type: UpsertVideoDto })
  @ApiResponse({ status: 200, description: "Video metadata saved successfully" })
  @ApiResponse({ status: 400, description: "Invalid duration or video URL" })
  @ApiResponse({ status: 403, description: "Forbidden - Course ownership failed" })
  @ApiResponse({ status: 404, description: "Lesson not found" })
  async upsertVideo(@Param("id") id: string, @Body() dto: UpsertVideoDto) {
    return this.lessonsService.upsertVideo(id, dto);
  }

  @Post("lessons/:id/resources")
  @UseGuards(JwtAuthGuard, RolesGuard, CourseOwnershipGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Add downloadable resource to lesson" })
  @ApiParam({ name: "id", type: String, description: "Lesson UUID" })
  @ApiBody({ type: CreateResourceDto })
  @ApiResponse({ status: 201, description: "Resource added successfully" })
  @ApiResponse({ status: 400, description: "Validation failure" })
  @ApiResponse({ status: 403, description: "Forbidden - Course ownership failed" })
  @ApiResponse({ status: 404, description: "Lesson not found" })
  async addResource(@Param("id") id: string, @Body() dto: CreateResourceDto) {
    return this.resourcesService.create(id, dto);
  }
}
