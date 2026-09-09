import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Length,
  Matches,
} from "class-validator";
import { MediaType } from "../../generated/prisma/client";

export class CheckDuplicateDto {
  @ApiProperty({
    type: String,
    example: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    description: "SHA-256 content hash of the file (64-character hexadecimal)",
  })
  @IsString()
  @IsNotEmpty()
  @Length(64, 64)
  @Matches(/^[a-f0-9]{64}$/i, {
    message: "hash must be a valid 64-character hexadecimal SHA-256 string",
  })
  hash!: string;

  @ApiProperty({
    enum: MediaType,
    example: MediaType.DOCUMENT,
    description: "Media type: DOCUMENT or VIDEO",
  })
  @IsEnum(MediaType)
  mediaType!: MediaType;

  @ApiPropertyOptional({
    type: Number,
    example: 1048576,
    description: "File size in bytes (optional)",
  })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  fileSize?: number;
}
