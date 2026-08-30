import {
  BadRequestException,
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
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

@ApiTags("Media & Uploads")
@Controller("upload")
export class UploadController {
  constructor(
    @Inject(CloudinaryService)
    private readonly cloudinaryService: CloudinaryService,
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
}
