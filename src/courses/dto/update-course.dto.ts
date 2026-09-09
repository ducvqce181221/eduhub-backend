import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";
import { CourseLevel } from "../../generated/prisma/client";

export class UpdateCourseDto {
  @ApiPropertyOptional({
    type: String,
    example: "Updated NestJS Masterclass 2026",
    description: "Updated course title",
    maxLength: 200,
  })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({
    type: String,
    example: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    description: "Updated category UUID (must be active)",
  })
  @IsUUID()
  @IsOptional()
  categoryId?: string;

  @ApiPropertyOptional({
    type: String,
    example: "Updated course description with new advanced modules.",
    description: "Updated course description",
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    type: String,
    example:
      "https://res.cloudinary.com/demo/image/upload/v1/courses/nestjs-v2.jpg",
    description: "Updated cover thumbnail URL",
    maxLength: 500,
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  thumbnailUrl?: string;

  @ApiPropertyOptional({
    enum: CourseLevel,
    example: CourseLevel.INTERMEDIATE,
    description: "Updated difficulty level",
  })
  @IsEnum(CourseLevel)
  @IsOptional()
  level?: CourseLevel;
}
