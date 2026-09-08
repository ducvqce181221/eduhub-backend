import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { Transform } from "class-transformer";

export class ForgotPasswordDto {
  @ApiProperty({
    type: String,
    example: "student@eduhub.dev",
    description: "Registered user email address",
  })
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: "Invalid email format" })
  @IsNotEmpty({ message: "Email is required" })
  email!: string;

  @ApiPropertyOptional({
    type: String,
    example: "0.xxxxxxxx.token",
    description: "Cloudflare Turnstile verification response token",
  })
  @IsOptional()
  @IsString()
  turnstileToken?: string;
}
