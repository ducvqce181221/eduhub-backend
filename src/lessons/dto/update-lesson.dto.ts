import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateLessonDto {
  @ApiPropertyOptional({
    type: String,
    example: "Lesson 1: Introduction to NestJS Controllers (Updated)",
    description: "Updated lesson title",
    maxLength: 200,
  })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({
    type: String,
    example: "Updated detailed lesson description.",
    description: "Updated lesson description",
  })
  @IsString()
  @IsOptional()
  description?: string;
}
