import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsString, IsUUID, ValidateNested } from "class-validator";
import { Type } from "class-transformer";

export class SubmitAnswerDto {
  @ApiProperty({
    type: String,
    example: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    description: "Question UUID",
  })
  @IsUUID()
  @IsString()
  questionId!: string;

  @ApiProperty({
    type: String,
    example: "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed",
    description: "Selected answer choice UUID",
  })
  @IsUUID()
  @IsString()
  selectedAnswerId!: string;
}

export class SubmitQuizAttemptDto {
  @ApiProperty({
    type: [SubmitAnswerDto],
    description: "List of submitted answers for the quiz questions",
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubmitAnswerDto)
  answers!: SubmitAnswerDto[];
}
