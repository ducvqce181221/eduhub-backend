import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from "class-validator";

export class UpdateQuizDto {
  @ApiPropertyOptional({
    type: String,
    example: "Updated Quiz Title",
    description: "Updated quiz title",
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({
    type: String,
    example: "Updated quiz description",
    description: "Updated quiz description",
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    type: Number,
    example: 85,
    description: "Passing score percentage between 1 and 100",
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  passScore?: number;
}
