import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
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
import { MediaAssetsService } from "./media-assets.service";
import { QueryMediaAssetsDto } from "./dto/query-media-assets.dto";
import { CreateExternalAssetDto } from "./dto/create-external-asset.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { Role } from "../generated/prisma/client";

@ApiTags("Media Assets Library")
@Controller("media-assets")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.TEACHER, Role.ADMIN)
@ApiBearerAuth()
export class MediaAssetsController {
  constructor(
    @Inject(MediaAssetsService)
    private readonly mediaAssetsService: MediaAssetsService,
  ) {}

  @Get()
  @ApiOperation({
    summary: "Browse and search media assets library (Per-teacher / Admin global)",
  })
  @ApiResponse({ status: 200, description: "Paginated list of media assets" })
  async findAll(@Query() query: QueryMediaAssetsDto, @Req() req: Request) {
    const user = req.user as { id: string; role: Role };
    return this.mediaAssetsService.findAll(query, user);
  }

  @Post("external")
  @ApiOperation({
    summary: "Add external resource / video by URL (Validates scheme & reachability)",
  })
  @ApiBody({ type: CreateExternalAssetDto })
  @ApiResponse({ status: 201, description: "External media asset added successfully" })
  @ApiResponse({
    status: 400,
    description: "Invalid URL, private address forbidden, or unreachable target",
  })
  async createExternal(@Body() dto: CreateExternalAssetDto, @Req() req: Request) {
    const user = req.user as { id: string; role: Role };
    return this.mediaAssetsService.createExternal(dto, user);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get media asset details by ID" })
  @ApiParam({ name: "id", type: String, description: "Media Asset UUID" })
  @ApiResponse({ status: 200, description: "Media asset details" })
  @ApiResponse({ status: 403, description: "Forbidden - Asset ownership check failed" })
  @ApiResponse({ status: 404, description: "Asset not found" })
  async findOne(@Param("id") id: string, @Req() req: Request) {
    const user = req.user as { id: string; role: Role };
    return this.mediaAssetsService.findOne(id, user);
  }

  @Delete(":id")
  @ApiOperation({
    summary: "Delete media asset from library (Blocked if referenced by lessons)",
  })
  @ApiParam({ name: "id", type: String, description: "Media Asset UUID" })
  @ApiResponse({ status: 200, description: "Media asset deleted successfully" })
  @ApiResponse({ status: 400, description: "Asset is currently in use by lessons" })
  @ApiResponse({ status: 403, description: "Forbidden - Asset ownership check failed" })
  @ApiResponse({ status: 404, description: "Asset not found" })
  async remove(@Param("id") id: string, @Req() req: Request) {
    const user = req.user as { id: string; role: Role };
    return this.mediaAssetsService.remove(id, user);
  }
}
