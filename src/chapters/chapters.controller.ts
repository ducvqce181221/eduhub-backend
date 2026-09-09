import {
  Body,
  Controller,
  Delete,
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
import { ChaptersService } from "./chapters.service";
import { CreateChapterDto } from "./dto/create-chapter.dto";
import { UpdateChapterDto } from "./dto/update-chapter.dto";
import { ReorderChaptersDto } from "./dto/reorder-chapters.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { CourseOwnershipGuard } from "../auth/guards/course-ownership.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { Role } from "../generated/prisma/client";

@ApiTags("Chapter Management")
@Controller()
export class ChaptersController {
  constructor(
    @Inject(ChaptersService)
    private readonly chaptersService: ChaptersService,
  ) {}

  @Post("courses/:courseId/chapters")
  @UseGuards(JwtAuthGuard, RolesGuard, CourseOwnershipGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Create chapter in course" })
  @ApiParam({ name: "courseId", type: String, description: "Course UUID" })
  @ApiBody({ type: CreateChapterDto })
  @ApiResponse({ status: 201, description: "Chapter created successfully" })
  @ApiResponse({ status: 400, description: "Validation failure" })
  @ApiResponse({ status: 403, description: "Forbidden - Course ownership failed" })
  @ApiResponse({ status: 404, description: "Course not found" })
  async create(
    @Param("courseId") courseId: string,
    @Body() dto: CreateChapterDto,
  ) {
    return this.chaptersService.create(courseId, dto);
  }

  @Patch("courses/:courseId/chapters/reorder")
  @UseGuards(JwtAuthGuard, RolesGuard, CourseOwnershipGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Batch reorder chapters in course" })
  @ApiParam({ name: "courseId", type: String, description: "Course UUID" })
  @ApiBody({ type: ReorderChaptersDto })
  @ApiResponse({ status: 200, description: "Chapters reordered successfully" })
  @ApiResponse({ status: 400, description: "Validation error or ID mismatch" })
  @ApiResponse({ status: 403, description: "Forbidden - Course ownership failed" })
  @ApiResponse({ status: 404, description: "Course not found" })
  async reorder(
    @Param("courseId") courseId: string,
    @Body() dto: ReorderChaptersDto,
  ) {
    return this.chaptersService.reorder(courseId, dto.orders);
  }

  @Patch("chapters/:id")
  @UseGuards(JwtAuthGuard, RolesGuard, CourseOwnershipGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Update chapter title/description" })
  @ApiParam({ name: "id", type: String, description: "Chapter UUID" })
  @ApiBody({ type: UpdateChapterDto })
  @ApiResponse({ status: 200, description: "Chapter updated successfully" })
  @ApiResponse({ status: 403, description: "Forbidden - Course ownership failed" })
  @ApiResponse({ status: 404, description: "Chapter not found" })
  async update(@Param("id") id: string, @Body() dto: UpdateChapterDto) {
    return this.chaptersService.update(id, dto);
  }

  @Delete("chapters/:id")
  @UseGuards(JwtAuthGuard, RolesGuard, CourseOwnershipGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      "Delete chapter and cascading lessons (Blocked if last chapter of published course)",
  })
  @ApiParam({ name: "id", type: String, description: "Chapter UUID" })
  @ApiResponse({ status: 200, description: "Chapter deleted successfully" })
  @ApiResponse({
    status: 400,
    description: "Bad Request - Cannot delete last chapter of published course",
  })
  @ApiResponse({ status: 403, description: "Forbidden - Course ownership failed" })
  @ApiResponse({ status: 404, description: "Chapter not found" })
  async remove(@Param("id") id: string) {
    return this.chaptersService.remove(id);
  }
}
