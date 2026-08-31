import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { CategoriesService } from "./categories.service";
import { CreateCategoryDto } from "./dto/create-category.dto";
import { UpdateCategoryDto } from "./dto/update-category.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { Role } from "../generated/prisma/client";

@ApiTags("Category Management")
@Controller("categories")
export class CategoriesController {
  constructor(
    @Inject(CategoriesService)
    private readonly categoriesService: CategoriesService,
  ) {}

  @Get()
  @ApiOperation({
    summary: "List active categories for course discovery/creation",
  })
  @ApiQuery({
    name: "onlyActive",
    required: false,
    type: Boolean,
    description: "Filter active categories (default: true)",
  })
  @ApiResponse({ status: 200, description: "List of categories" })
  async findAll(@Query("onlyActive") onlyActive?: string) {
    const filterActive = onlyActive === "false" ? false : true;
    return this.categoriesService.findAll(filterActive);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get category details by ID" })
  @ApiParam({ name: "id", type: String, description: "Category UUID" })
  @ApiResponse({ status: 200, description: "Category details" })
  @ApiResponse({ status: 404, description: "Category not found" })
  async findOne(@Param("id") id: string) {
    return this.categoriesService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Create new course category (Admin only)" })
  @ApiBody({ type: CreateCategoryDto })
  @ApiResponse({ status: 201, description: "Category created successfully" })
  @ApiResponse({
    status: 409,
    description: "Category name or slug already exists",
  })
  @ApiResponse({ status: 403, description: "Forbidden - Admin role required" })
  async create(@Body() dto: CreateCategoryDto) {
    return this.categoriesService.create(dto);
  }

  @Patch(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Update category details or toggle active status (Admin only)",
  })
  @ApiParam({ name: "id", type: String, description: "Category UUID" })
  @ApiBody({ type: UpdateCategoryDto })
  @ApiResponse({ status: 200, description: "Category updated successfully" })
  @ApiResponse({ status: 404, description: "Category not found" })
  @ApiResponse({
    status: 409,
    description: "Category name or slug already exists",
  })
  @ApiResponse({ status: 403, description: "Forbidden - Admin role required" })
  async update(@Param("id") id: string, @Body() dto: UpdateCategoryDto) {
    return this.categoriesService.update(id, dto);
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      "Hard delete category (Admin only, allowed only if 0 courses reference it)",
  })
  @ApiParam({ name: "id", type: String, description: "Category UUID" })
  @ApiResponse({ status: 200, description: "Category deleted successfully" })
  @ApiResponse({ status: 404, description: "Category not found" })
  @ApiResponse({
    status: 409,
    description: "Conflict: Category has active courses attached",
  })
  @ApiResponse({ status: 403, description: "Forbidden - Admin role required" })
  async remove(@Param("id") id: string) {
    return this.categoriesService.remove(id);
  }
}
