import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";
import { CourseLevel } from "../../generated/prisma/client";

export class CreateCourseDto {
  @ApiProperty({
    type: String,
    example: "Complete NestJS Masterclass",
    description: "Course title (max 200 chars)",
    maxLength: 200,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @ApiProperty({
    type: String,
    example: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    description: "UUID of an active category",
  })
  @IsUUID()
  @IsNotEmpty()
  categoryId!: string;

  @ApiPropertyOptional({
    type: String,
    example:
      "Learn NestJS architecture, Prisma, Docker, Redis, and RabbitMQ from scratch.",
    description: "Detailed course description",
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    type: String,
    example:
      "https://res.cloudinary.com/demo/image/upload/v1/courses/nestjs.jpg",
    description: "Course cover thumbnail URL",
    maxLength: 500,
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  thumbnailUrl?: string;

  @ApiPropertyOptional({
    enum: CourseLevel,
    example: CourseLevel.BEGINNER,
    default: CourseLevel.BEGINNER,
    description: "Difficulty level of the course",
  })
  @IsEnum(CourseLevel)
  @IsOptional()
  level?: CourseLevel;
}
