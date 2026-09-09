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

  @ApiProperty({
    type: Boolean,
    required: false,
    description: "Whether to explicitly enforce delta heartbeat anti-spoofing check in test environments",
  })
  enforceDeltaCheck?: boolean;
}
