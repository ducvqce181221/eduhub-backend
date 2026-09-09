import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from "class-validator";
import { MediaType } from "../../generated/prisma/client";

export class CreateExternalAssetDto {
  @ApiProperty({
    type: String,
    example: "NestJS Official Documentation",
    description: "Display name of the external asset",
    maxLength: 200,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @ApiProperty({
    type: String,
    example: "https://docs.nestjs.com",
    description: "Valid external HTTP or HTTPS URL",
    maxLength: 500,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  url!: string;

  @ApiProperty({
    enum: MediaType,
    example: MediaType.DOCUMENT,
    description: "Media type: DOCUMENT or VIDEO",
  })
  @IsEnum(MediaType)
  mediaType!: MediaType;

  @ApiPropertyOptional({
    type: Number,
    example: 720,
    description: "Duration of video in seconds (optional, applicable for videos)",
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  durationSeconds?: number;
}
