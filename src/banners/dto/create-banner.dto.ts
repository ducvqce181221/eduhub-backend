import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";

export class CreateBannerDto {
  @ApiProperty({
    type: String,
    description: "Title or promo name of the banner",
    example: "Summer Tech Bootcamp 2026",
    maxLength: 200,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @ApiProperty({
    type: String,
    description: "Image URL for the banner (recommended 1200x400 / 3:1)",
    example: "https://res.cloudinary.com/demo/image/upload/banner.jpg",
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  imageUrl!: string;

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
    type: Boolean,
    description: "Whether the banner is active and visible on Home",
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
