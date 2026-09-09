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
import { BannersService } from "./banners.service";
import { CreateBannerDto } from "./dto/create-banner.dto";
import { UpdateBannerDto } from "./dto/update-banner.dto";
import { ReorderBannersDto } from "./dto/reorder-banners.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { Role } from "../generated/prisma/client";

@ApiTags("Banners & Promo Sliders")
@Controller()
export class BannersController {
  constructor(
    @Inject(BannersService)
    private readonly bannersService: BannersService,
  ) {}

  @Get("banners")
  @ApiOperation({ summary: "Get active promotional banners for Home carousel (Public)" })
  @ApiResponse({ status: 200, description: "List of active banners ordered by sequence" })
  async getActiveBanners() {
    return this.bannersService.findActive();
  }

  @Get("admin/banners")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: "List all banners including inactive (Admin only)" })
  @ApiResponse({ status: 200, description: "All platform banners" })
  async getAllBanners() {
    return this.bannersService.findAll();
  }

  @Post("admin/banners")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Create new promotional banner (Admin only)" })
  @ApiBody({ type: CreateBannerDto })
  @ApiResponse({ status: 201, description: "Banner created successfully" })
  async createBanner(@Body() dto: CreateBannerDto) {
    return this.bannersService.create(dto);
  }

  @Patch("admin/banners/reorder")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Batch reorder banner sequence (Admin only)" })
  @ApiBody({ type: ReorderBannersDto })
  @ApiResponse({ status: 200, description: "Banners reordered successfully" })
  async reorderBanners(@Body() dto: ReorderBannersDto) {
    return this.bannersService.reorder(dto.orders);
  }

  @Patch("admin/banners/:id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Update banner details or active status (Admin only)" })
  @ApiParam({ name: "id", type: String, description: "Banner UUID" })
  @ApiBody({ type: UpdateBannerDto })
  @ApiResponse({ status: 200, description: "Banner updated successfully" })
  async updateBanner(
    @Param("id") id: string,
    @Body() dto: UpdateBannerDto,
  ) {
    return this.bannersService.update(id, dto);
  }

  @Delete("admin/banners/:id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Delete banner (Admin only)" })
  @ApiParam({ name: "id", type: String, description: "Banner UUID" })
  @ApiResponse({ status: 200, description: "Banner deleted successfully" })
  async removeBanner(@Param("id") id: string) {
    return this.bannersService.remove(id);
  }
}
