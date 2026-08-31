import {
  Body,
  Controller,
  Delete,
  Inject,
  Param,
  Patch,
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
import { ResourcesService } from "./resources.service";
import { UpdateResourceDto } from "./dto/update-resource.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { CourseOwnershipGuard } from "../auth/guards/course-ownership.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { Role } from "../generated/prisma/client";

@ApiTags("Lesson Management")
@Controller("resources")
export class ResourcesController {
  constructor(
    @Inject(ResourcesService)
    private readonly resourcesService: ResourcesService,
  ) {}

  @Patch(":id")
  @UseGuards(JwtAuthGuard, RolesGuard, CourseOwnershipGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Update resource metadata" })
  @ApiParam({ name: "id", type: String, description: "Resource UUID" })
  @ApiBody({ type: UpdateResourceDto })
  @ApiResponse({ status: 200, description: "Resource updated successfully" })
  @ApiResponse({ status: 400, description: "Validation failure" })
  @ApiResponse({ status: 403, description: "Forbidden - Course ownership failed" })
  @ApiResponse({ status: 404, description: "Resource not found" })
  async update(@Param("id") id: string, @Body() dto: UpdateResourceDto) {
    return this.resourcesService.update(id, dto);
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard, RolesGuard, CourseOwnershipGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Delete resource" })
  @ApiParam({ name: "id", type: String, description: "Resource UUID" })
  @ApiResponse({ status: 200, description: "Resource deleted successfully" })
  @ApiResponse({ status: 403, description: "Forbidden - Course ownership failed" })
  @ApiResponse({ status: 404, description: "Resource not found" })
  async remove(@Param("id") id: string) {
    return this.resourcesService.remove(id);
  }
}
