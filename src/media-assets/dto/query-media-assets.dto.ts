import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import { AssetSource, MediaType } from "../../generated/prisma/client";

export class QueryMediaAssetsDto {
  @ApiPropertyOptional({ default: 1, description: "Page number" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 20, description: "Items per page (max 100)" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  @ApiPropertyOptional({ description: "Search keyword for asset name" })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    enum: MediaType,
    description: "Filter by media type: DOCUMENT or VIDEO",
  })
  @IsOptional()
  @IsEnum(MediaType)
  mediaType?: MediaType;

  @ApiPropertyOptional({
    enum: AssetSource,
    description: "Filter by source: R2_UPLOAD or EXTERNAL_URL",
  })
  @IsOptional()
  @IsEnum(AssetSource)
  source?: AssetSource;
}
