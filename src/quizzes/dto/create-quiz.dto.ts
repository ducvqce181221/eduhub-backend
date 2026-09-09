import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from "class-validator";

export class CreateQuizDto {
  @ApiProperty({
    type: String,
    example: "NestJS Fundamentals Quiz",
    description: "Quiz title",
  })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional({
    type: String,
    example: "Assess your knowledge of controllers and services",
    description: "Optional quiz description",
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    type: Number,
    example: 80,
    description: "Passing score percentage between 1 and 100 (Default: 80)",
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  passScore?: number;
}
