import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { CreateAnswerDto } from "./create-answer.dto";

export class CreateQuestionDto {
  @ApiProperty({
    type: String,
    example: "What is the primary role of a NestJS Controller?",
    description: "Question text content",
  })
  @IsString()
  @MinLength(1)
  content!: string;

  @ApiPropertyOptional({
    type: Number,
    example: 1,
    description: "Sequential display order of question (defaults to max + 1)",
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  order?: number;

  @ApiPropertyOptional({
    type: Number,
    example: 10,
    description: "Points awarded for this question (defaults to 1, minimum 1)",
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  points?: number;

  @ApiProperty({
    type: [CreateAnswerDto],
    description: "List of answer choices (minimum 2 choices, exactly 1 isCorrect=true)",
  })
  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => CreateAnswerDto)
  answers!: CreateAnswerDto[];
}
