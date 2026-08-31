import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, MinLength } from "class-validator";

export class UpdateProfileDto {
  @ApiPropertyOptional({
    type: String,
    example: "Johnathan Doe",
    description: "Full name of the user",
  })
  @IsOptional()
  @IsString()
  @MinLength(2, { message: "Full name must be at least 2 characters long" })
  fullName?: string;

  @ApiPropertyOptional({
    type: String,
    example: "https://res.cloudinary.com/demo/image/upload/avatar.png",
    description: "Avatar URL of the user",
  })
  @IsOptional()
  @IsString()
  avatarUrl?: string;
}
