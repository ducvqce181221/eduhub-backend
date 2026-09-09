import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Max,
  MaxLength,
} from "class-validator";

export class CreateResourceDto {
  @ApiProperty({
    type: String,
    example: "Lecture-Slide-NestJS-Module.pdf",
    description: "Resource file display name",
    maxLength: 200,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @ApiProperty({
    type: String,
    example: "https://media.eduhub.local/resources/slides-1.pdf",
    description: "URL to the downloadable resource",
    maxLength: 500,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  fileUrl!: string;

  @ApiProperty({
    type: String,
    example: "application/pdf",
    description: "MIME type or file format extension",
    maxLength: 50,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  fileType!: string;

  @ApiPropertyOptional({
    type: Number,
    example: 2048576,
    description: "File size in bytes (max 2,147,483,647)",
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  @Max(2147483647)
  fileSize?: number;

  @ApiPropertyOptional({
    type: String,
    example: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    description: "SHA-256 content hash of the file",
  })
  @IsOptional()
  @IsString()
  contentHash?: string;

  @ApiPropertyOptional({
    type: String,
    example: "123e4567-e89b-12d3-a456-426614174000",
    description: "Associated MediaAsset UUID if selected from library",
  })
  @IsOptional()
  @IsUUID()
  assetId?: string;
}

