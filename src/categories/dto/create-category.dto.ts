import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";

export class CreateCategoryDto {
  @ApiProperty({
    type: String,
    example: "Web Development",
    description: "Category name (must be unique)",
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({
    type: String,
    example: "web-development",
    description: "Category slug (auto-generated from name if omitted)",
    maxLength: 120,
  })
  @IsString()
  @IsOptional()
  @MaxLength(120)
  slug?: string;

  @ApiPropertyOptional({
    type: String,
    example:
      "Courses related to frontend, backend, and fullstack web development.",
    description: "Category description",
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    type: Boolean,
    example: true,
    default: true,
    description:
      "Whether the category is active and visible for course creation",
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
