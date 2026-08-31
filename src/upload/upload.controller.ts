import {
  BadRequestException,
  Body,
  Controller,
  Inject,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
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
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { Role } from "../generated/prisma/client";

@ApiTags("Media & Uploads")
@Controller("upload")
export class UploadController {
  constructor(
    @Inject(CloudinaryService)
    private readonly cloudinaryService: CloudinaryService,
    @Inject(R2StorageService)
    private readonly r2StorageService: R2StorageService,
  ) {}

  @Post("image")
  @UseGuards(JwtAuthGuard)
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
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
  async generatePresignedUrl(@Body() dto: PresignedUrlDto) {
    if (!dto) {
      throw new BadRequestException("Missing request body");
    }
    return this.r2StorageService.generatePresignedPutUrl(dto);
  }
}
