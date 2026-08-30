import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty, IsString } from "class-validator";
import { Transform } from "class-transformer";

export class LoginDto {
  @ApiProperty({
    example: "student@eduhub.dev",
    description: "User email address",
  })
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: "Invalid email format" })
  @IsNotEmpty({ message: "Email is required" })
  email!: string;

  @ApiProperty({
    example: "Password123!",
    description: "User password",
  })
  @IsString()
  @IsNotEmpty({ message: "Password is required" })
  password!: string;
}
