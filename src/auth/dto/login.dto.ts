import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { Transform } from "class-transformer";

export class LoginDto {
  @ApiProperty({
    type: String,
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
    type: String,
    example: "Password123!",
    description: "User password",
  })
  @IsString()
  @IsNotEmpty({ message: "Password is required" })
  password!: string;

  @ApiProperty({
    type: String,
    required: false,
    example: "0.xxxxxxxx.token",
    description: "Cloudflare Turnstile verification response token",
  })
  @IsOptional()
  @IsString()
  turnstileToken?: string;
}
