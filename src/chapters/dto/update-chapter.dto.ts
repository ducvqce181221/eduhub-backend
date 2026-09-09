import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateChapterDto {
  @ApiPropertyOptional({
    type: String,
    example: "Chapter 1: NestJS Essentials (Updated)",
    description: "Updated chapter title",
    maxLength: 200,
  })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({
    type: String,
    example: "Updated chapter description.",
    description: "Updated chapter description",
  })
  @IsString()
  @IsOptional()
  description?: string;
}
