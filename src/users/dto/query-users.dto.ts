import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";
import { Transform, Type } from "class-transformer";

export class QueryUsersDto {
  @ApiPropertyOptional({
    type: Number,
    example: 1,
    description: "Page number (default: 1)",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    type: Number,
    example: 10,
    description: "Number of records per page (max: 100, default: 10)",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiPropertyOptional({
    type: String,
    example: "john",
    description: "Search keyword for fullName or email",
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    type: String,
    enum: ["STUDENT", "TEACHER", "ADMIN"],
    example: "TEACHER",
    description: "Filter by user role",
  })
  @IsOptional()
  @IsEnum(["STUDENT", "TEACHER", "ADMIN"], {
    message: "Role must be STUDENT, TEACHER, or ADMIN",
  })
  role?: "STUDENT" | "TEACHER" | "ADMIN";

  @ApiPropertyOptional({
    type: Boolean,
    example: true,
    description: "Filter by account active status",
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === "true" || value === true) return true;
    if (value === "false" || value === false) return false;
    return undefined;
  })
  @IsBoolean()
  isActive?: boolean;
}
