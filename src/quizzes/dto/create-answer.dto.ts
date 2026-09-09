import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsString, MinLength } from "class-validator";

export class CreateAnswerDto {
  @ApiProperty({
    type: String,
    example: "Dependency Injection is a design pattern",
    description: "Answer choice content",
  })
  @IsString()
  @MinLength(1)
  content!: string;

  @ApiProperty({
    type: Boolean,
    example: true,
    description: "Whether this answer choice is correct (strictly 1 true per question)",
  })
  @IsBoolean()
  isCorrect!: boolean;
}
