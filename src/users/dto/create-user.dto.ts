import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from "class-validator";
import { Transform } from "class-transformer";

export class CreateUserDto {
  @ApiProperty({
    type: String,
    example: "teacher@eduhub.dev",
    description: "User email address",
  })
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: "Invalid email format" })
  @IsNotEmpty({ message: "Email is required" })
  email!: string;

  @ApiProperty({
    type: String,
    example: "Password123!",
    description:
      "User password (min 8 chars, at least 1 uppercase, 1 lowercase, 1 number)",
  })
  @IsString()
  @MinLength(8, { message: "Password must be at least 8 characters long" })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/, {
    message:
      "Password must contain at least 1 uppercase letter, 1 lowercase letter, and 1 number",
  })
  password!: string;

  @ApiProperty({
    type: String,
    example: "Sarah Connor",
    description: "Full name of the user",
  })
  @IsString()
  @IsNotEmpty({ message: "Full name is required" })
  @MinLength(2, { message: "Full name must be at least 2 characters long" })
  fullName!: string;

  @ApiPropertyOptional({
    type: String,
    enum: ["STUDENT", "TEACHER", "ADMIN"],
    example: "TEACHER",
    description: "User role assigned by Admin (default: STUDENT)",
  })
  @IsOptional()
  @IsEnum(["STUDENT", "TEACHER", "ADMIN"], {
    message: "Role must be STUDENT, TEACHER, or ADMIN",
  })
  role?: "STUDENT" | "TEACHER" | "ADMIN";

  @ApiPropertyOptional({
    type: Boolean,
    example: true,
    description: "Account active status (default: true)",
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
