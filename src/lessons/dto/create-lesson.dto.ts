import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from "class-validator";

export class CreateLessonDto {
  @ApiProperty({
    type: String,
    example: "Lesson 1: Introduction to NestJS Controllers",
    description: "Lesson title (max 200 chars)",
    maxLength: 200,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional({
    type: String,
    example:
      "Learn how to define routes, route parameters, and query parameters.",
    description: "Detailed lesson description",
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    type: Number,
    example: 1,
    description: "Custom order index (auto-assigned as max+1 if omitted)",
  })
  @IsInt()
  @IsPositive()
  @IsOptional()
  order?: number;

  @ApiPropertyOptional({
    type: String,
    example: "https://media.eduhub.local/videos/lesson-1.mp4",
    description: "Optional initial video URL",
    maxLength: 500,
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  videoUrl?: string;

  @ApiPropertyOptional({
    type: Number,
    example: 600,
    description: "Optional video duration in seconds",
  })
  @IsInt()
  @IsPositive()
  @IsOptional()
  durationSeconds?: number;
}
