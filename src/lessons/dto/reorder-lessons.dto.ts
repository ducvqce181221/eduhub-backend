import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsPositive,
  IsUUID,
  ValidateNested,
} from "class-validator";

export class ReorderLessonItemDto {
  @ApiProperty({
    type: String,
    example: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    description: "UUID of the lesson",
  })
  @IsUUID()
  @IsNotEmpty()
  id!: string;

  @ApiProperty({
    type: Number,
    example: 1,
    description: "New sequential 1-based order index",
  })
  @IsInt()
  @IsPositive()
  order!: number;
}

export class ReorderLessonsDto {
  @ApiProperty({
    type: [ReorderLessonItemDto],
    description: "List of lessons with their updated order indices",
    example: [
      { id: "3fa85f64-5717-4562-b3fc-2c963f66afa6", order: 1 },
      { id: "7ca85f64-5717-4562-b3fc-2c963f66afa7", order: 2 },
    ],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReorderLessonItemDto)
  orders!: ReorderLessonItemDto[];
}
