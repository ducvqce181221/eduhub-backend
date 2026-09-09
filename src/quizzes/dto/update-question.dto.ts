import { ApiPropertyOptional } from "@nestjs/swagger";
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

export class UpdateQuestionDto {
  @ApiPropertyOptional({
    type: String,
    example: "Updated question content",
    description: "Question text content",
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  content?: string;

  @ApiPropertyOptional({
    type: Number,
    example: 1,
    description: "Sequential display order of question",
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  order?: number;

  @ApiPropertyOptional({
    type: Number,
    example: 15,
    description: "Points awarded for this question",
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  points?: number;

  @ApiPropertyOptional({
    type: [CreateAnswerDto],
    description: "Updated list of answer choices (minimum 2 choices, exactly 1 isCorrect=true)",
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => CreateAnswerDto)
  answers?: CreateAnswerDto[];
}
