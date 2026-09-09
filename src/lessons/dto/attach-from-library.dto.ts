import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export class AttachResourceFromLibraryDto {
  @ApiProperty({
    type: String,
    example: "123e4567-e89b-12d3-a456-426614174000",
    description: "UUID of the MediaAsset to attach as a resource",
  })
  @IsUUID()
  @IsNotEmpty()
  assetId!: string;

  @ApiPropertyOptional({
    type: String,
    example: "Custom Resource Display Name.pdf",
    description: "Optional custom display name (defaults to asset name)",
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  customName?: string;
}

export class AttachVideoFromLibraryDto {
  @ApiProperty({
    type: String,
    example: "123e4567-e89b-12d3-a456-426614174000",
    description: "UUID of the MediaAsset (VIDEO) to attach as lesson video",
  })
  @IsUUID()
  @IsNotEmpty()
  assetId!: string;

  @ApiPropertyOptional({
    type: String,
    example: "Custom Video Title",
    description: "Optional custom title for video (defaults to asset name)",
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  customTitle?: string;
}
