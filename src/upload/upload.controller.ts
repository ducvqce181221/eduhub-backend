import {
  BadRequestException,
  Body,
  Controller,
  Inject,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import type { Request } from "express";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { CloudinaryService } from "./cloudinary.service";
import type { UploadableFile } from "./cloudinary.service";
import { R2StorageService } from "./r2-storage.service";
import { PresignedUrlDto } from "./dto/presigned-url.dto";
import { CheckDuplicateDto } from "./dto/check-duplicate.dto";
import { PreviewUrlDto } from "./dto/preview-url.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { Role } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { RateLimitGuard } from "../auth/guards/rate-limit.guard";
import { RateLimit } from "../auth/decorators/rate-limit.decorator";

@ApiTags("Media & Uploads")
@Controller("upload")
export class UploadController {
  constructor(
    @Inject(CloudinaryService)
    private readonly cloudinaryService: CloudinaryService,
    @Inject(R2StorageService)
    private readonly r2StorageService: R2StorageService,
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  @Post("image")
  @UseGuards(RateLimitGuard, JwtAuthGuard)
  @RateLimit(20, 60)
  @ApiBearerAuth()
  @UseInterceptors(FileInterceptor("file"))
  @ApiOperation({ summary: "Upload image (Avatar / Thumbnail) to Cloudinary" })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      required: ["file"],
      properties: {
        file: {
          type: "string",
          format: "binary",
          description: "Image file (png, jpg, jpeg, webp, gif)",
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: "Image uploaded successfully; returns optimized Cloudinary URLs",
  })
  @ApiResponse({
    status: 400,
    description: "No file attached or invalid file type",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
  })
  @ApiResponse({
    status: 429,
    description: "Too Many Requests - Rate limit exceeded",
  })
  async uploadImage(@UploadedFile() file?: UploadableFile) {
    if (!file) {
      throw new BadRequestException("No image file provided");
    }

    if (!file.mimetype || !file.mimetype.startsWith("image/")) {
      throw new BadRequestException(
        "Invalid file type. Only image files are allowed.",
      );
    }

    return this.cloudinaryService.uploadImage(file);
  }

  @Post("presigned-url")
  @UseGuards(RateLimitGuard, JwtAuthGuard, RolesGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
  @RateLimit(20, 60)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      "Generate S3 Presigned PUT URL for client direct upload to Cloudflare R2",
  })
  @ApiBody({ type: PresignedUrlDto })
  @ApiResponse({
    status: 201,
    description: "Presigned URL minted successfully",
  })
  @ApiResponse({
    status: 400,
    description: "Invalid file type or size limits exceeded",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Teacher/Admin role required",
  })
  @ApiResponse({
    status: 429,
    description: "Too Many Requests - Rate limit exceeded",
  })
  async generatePresignedUrl(@Body() dto: PresignedUrlDto) {
    if (!dto) {
      throw new BadRequestException("Missing request body");
    }
    return this.r2StorageService.generatePresignedPutUrl(dto);
  }

  @Post("check-duplicate")
  @UseGuards(RateLimitGuard, JwtAuthGuard, RolesGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
  @RateLimit(30, 60)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      "Check if a file with the given SHA-256 hash already exists in the user's library",
  })
  @ApiBody({ type: CheckDuplicateDto })
  @ApiResponse({
    status: 200,
    description: "Duplicate detection result",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Teacher/Admin role required",
  })
  async checkDuplicate(@Body() dto: CheckDuplicateDto, @Req() req: Request) {
    const user = req.user as { id: string; role: Role };

    const where: any = {
      contentHash: dto.hash.toLowerCase().trim(),
      mediaType: dto.mediaType,
    };

    // Teachers search within their own library; Admins search platform-wide
    if (user.role !== Role.ADMIN) {
      where.uploaderId = user.id;
    }

    const existingAsset = await this.prisma.mediaAsset.findFirst({
      where,
      orderBy: { createdAt: "desc" },
    });

    return {
      isDuplicate: !!existingAsset,
      asset: existingAsset || null,
      existingAsset: existingAsset || null,
    };
  }

  @Post("preview-url")
  @UseGuards(RateLimitGuard, JwtAuthGuard, RolesGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
  @RateLimit(30, 60)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      "Generate presigned GET preview URL for uploaded video or resource",
  })
  @ApiBody({ type: PreviewUrlDto })
  @ApiResponse({
    status: 200,
    description: "Presigned preview URL generated",
  })
  @ApiResponse({
    status: 400,
    description: "Missing url parameter",
  })
  async generatePreviewUrl(@Body() dto: PreviewUrlDto) {
    if (!dto || !dto.url) {
      throw new BadRequestException("Missing url parameter");
    }
    const previewUrl = await this.r2StorageService.generatePresignedGetUrl(
      dto.url,
      900,
    );
    return { previewUrl };
  }
}
