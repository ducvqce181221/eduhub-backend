import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from "class-validator";

export class UpdateBannerDto {
  @ApiPropertyOptional({
    type: String,
    description: "Title or promo name of the banner",
    example: "Summer Tech Bootcamp 2026",
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({
    type: String,
    description: "Image URL for the banner (recommended 1200x400 / 3:1)",
    example: "https://res.cloudinary.com/demo/image/upload/banner.jpg",
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  imageUrl?: string;

  @ApiPropertyOptional({
    type: String,
    description: "Destination URL or relative route when clicked",
    example: "/courses/nextjs-fullstack-mastery",
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  linkUrl?: string;

  @ApiPropertyOptional({
    type: Number,
    description: "Sort display order",
    example: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;

  @ApiPropertyOptional({
    type: Boolean,
    description: "Whether the banner is active and visible on Home",
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
