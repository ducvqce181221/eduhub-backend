import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayNotEmpty,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsUUID,
  Min,
  ValidateNested,
} from "class-validator";

export class BannerOrderItemDto {
  @ApiProperty({
    type: String,
    description: "Banner UUID",
    example: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
  })
  @IsUUID("4")
  @IsNotEmpty()
  id!: string;

  @ApiProperty({
    type: Number,
    description: "New 0-indexed or 1-indexed order sequence",
    example: 1,
  })
  @IsInt()
  @Min(0)
  order!: number;
}

export class ReorderBannersDto {
  @ApiProperty({
    description: "Array of banners with updated orders",
    type: [BannerOrderItemDto],
  })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => BannerOrderItemDto)
  orders!: BannerOrderItemDto[];
}
