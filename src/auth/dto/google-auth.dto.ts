import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class GoogleAuthDto {
  @ApiPropertyOptional({
    type: String,
    description: "Google ID Token / Credential string from Google Identity Services",
    example: "eyJhbGciOiJSUzI1NiIsImtpZCI6...",
  })
  @IsOptional()
  @IsString()
  credential?: string;

  @ApiPropertyOptional({
    type: String,
    description: "Google Subject / User ID",
    example: "109827349182374918237",
  })
  @IsOptional()
  @IsString()
  googleId?: string;

  @ApiPropertyOptional({
    type: String,
    description: "Google user email address",
    example: "student@example.com",
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    type: String,
    description: "Google user display name",
    example: "John Doe",
  })
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiPropertyOptional({
    type: String,
    description: "Google user avatar URL",
    example: "https://lh3.googleusercontent.com/a/default-user",
  })
  @IsOptional()
  @IsString()
  avatarUrl?: string;
}
