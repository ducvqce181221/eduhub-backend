import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class RefreshTokenDto {
  @ApiPropertyOptional({
    type: String,
    example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    description: "Valid JWT refresh token (optional if sent via httpOnly cookie)",
  })
  @IsString()
  @IsOptional()
  refreshToken?: string;
}

