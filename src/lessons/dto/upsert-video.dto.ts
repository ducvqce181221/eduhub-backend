import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from "class-validator";

export class UpsertVideoDto {
  @ApiProperty({
    type: String,
    example: "https://media.eduhub.local/videos/lesson-1-intro.mp4",
    description: "URL to the video asset stored in Cloudflare R2 / S3",
    maxLength: 500,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  videoUrl!: string;

  @ApiProperty({
    type: Number,
    example: 720,
    description: "Duration of the video in seconds (must be > 0)",
  })
  @IsInt()
  @IsPositive()
  durationSeconds!: number;

  @ApiPropertyOptional({
    type: String,
    example: "Lesson 1: Video lecture",
    description: "Optional custom title for the video",
    maxLength: 200,
  })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({
    type: String,
    example: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    description: "SHA-256 content hash of the video file",
  })
  @IsOptional()
  @IsString()
  contentHash?: string;

  @ApiPropertyOptional({
    type: String,
    example: "123e4567-e89b-12d3-a456-426614174000",
    description: "Associated MediaAsset UUID if selected from library",
  })
  @IsOptional()
  @IsString()
  assetId?: string;
}
