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
}
