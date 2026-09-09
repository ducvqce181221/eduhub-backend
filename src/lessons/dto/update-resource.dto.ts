import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MaxLength,
} from "class-validator";

export class UpdateResourceDto {
  @ApiPropertyOptional({
    type: String,
    example: "Updated-Lecture-Slide.pdf",
    description: "Updated resource name",
    maxLength: 200,
  })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({
    type: String,
    example: "https://media.eduhub.local/resources/slides-v2.pdf",
    description: "Updated resource URL",
    maxLength: 500,
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  fileUrl?: string;

  @ApiPropertyOptional({
    type: String,
    example: "application/pdf",
    description: "Updated MIME type",
    maxLength: 50,
  })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  fileType?: string;

  @ApiPropertyOptional({
    type: Number,
    example: 3145728,
    description: "Updated file size in bytes",
  })
  @IsInt()
  @IsPositive()
  @Max(2147483647)
  @IsOptional()
  fileSize?: number;
}
