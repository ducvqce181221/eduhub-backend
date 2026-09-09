import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateCategoryDto {
  @ApiPropertyOptional({
    type: String,
    example: "Mobile App Development",
    description: "Updated category name",
    maxLength: 100,
  })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({
    type: String,
    example: "mobile-app-development",
    description: "Updated category slug",
    maxLength: 120,
  })
  @IsString()
  @IsOptional()
  @MaxLength(120)
  slug?: string;

  @ApiPropertyOptional({
    type: String,
    example:
      "Courses related to iOS, Android, and cross-platform mobile development.",
    description: "Updated category description",
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    type: Boolean,
    example: false,
    description:
      "Toggle active state (inactive categories are hidden from course creation)",
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
