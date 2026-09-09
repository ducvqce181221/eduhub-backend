import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from "class-validator";

export class CreateChapterDto {
  @ApiProperty({
    type: String,
    example: "Chapter 1: Getting Started with NestJS",
    description: "Chapter title",
    maxLength: 200,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional({
    type: String,
    example: "Overview of NestJS concepts, controllers, and modules.",
    description: "Chapter description",
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
}
