import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString, Matches, MinLength } from "class-validator";

export class ResetPasswordDto {
  @ApiProperty({
    type: String,
    example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    description: "Valid password reset token",
  })
  @IsString()
  @IsNotEmpty({ message: "Reset token is required" })
  token!: string;

  @ApiProperty({
    type: String,
    example: "NewSecurePassword123!",
    description:
      "New password (min 8 chars, at least 1 uppercase, 1 lowercase, 1 number)",
  })
  @IsString()
  @MinLength(8, { message: "Password must be at least 8 characters long" })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/, {
    message:
      "Password must contain at least 1 uppercase letter, 1 lowercase letter, and 1 number",
  })
  newPassword!: string;

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
