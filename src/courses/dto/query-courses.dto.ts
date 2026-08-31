import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from "class-validator";
import { CourseLevel } from "../../generated/prisma/client";

export class QueryCoursesDto {
  @ApiPropertyOptional({
    type: Number,
    example: 1,
    default: 1,
    description: "Page number (1-indexed)",
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page: number = 1;

  @ApiPropertyOptional({
    type: Number,
    example: 10,
    default: 10,
    description: "Items per page",
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  limit: number = 10;

  @ApiPropertyOptional({
    type: String,
    example: "NestJS",
    description: "Search keyword for course title or description",
  })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({
    type: String,
    example: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    description: "Filter courses by category UUID",
  })
  @IsUUID()
  @IsOptional()
  categoryId?: string;

  @ApiPropertyOptional({
    enum: CourseLevel,
    example: CourseLevel.BEGINNER,
    description: "Filter courses by difficulty level",
  })
  @IsEnum(CourseLevel)
  @IsOptional()
  level?: CourseLevel;
}
