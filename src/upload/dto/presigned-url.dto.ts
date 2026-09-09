import { ApiProperty } from "@nestjs/swagger";
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsString,
} from "class-validator";

export enum UploadFolder {
  VIDEOS = "videos",
  RESOURCES = "resources",
}

export class PresignedUrlDto {
  @ApiProperty({
    type: String,
    example: "lesson-intro.mp4",
    description: "Name of the file to be uploaded",
  })
  @IsString()
  @IsNotEmpty()
  fileName!: string;

  @ApiProperty({
    type: String,
    example: "video/mp4",
    description: "MIME type of the file",
  })
  @IsString()
  @IsNotEmpty()
  fileType!: string;

  @ApiProperty({
    type: Number,
    example: 15728640,
    description:
      "File size in bytes (max 200MB for videos, max 50MB for resources)",
  })
  @IsNumber()
  @IsPositive()
  fileSize!: number;

  @ApiProperty({
    enum: UploadFolder,
    example: UploadFolder.VIDEOS,
    description: "Target folder in storage (videos or resources)",
  })
  @IsEnum(UploadFolder)
  folder!: UploadFolder;
}
