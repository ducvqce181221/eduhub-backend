import { ApiProperty } from "@nestjs/swagger";
import { IsInt, Min } from "class-validator";

export class UpdateLessonProgressDto {
  @ApiProperty({
    type: Number,
    example: 300,
    description: "Watched seconds in the lesson video",
  })
  @IsInt()
  @Min(0)
  watchedSeconds!: number;
}
