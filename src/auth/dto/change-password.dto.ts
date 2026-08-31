import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, Matches, MinLength } from "class-validator";

export class ChangePasswordDto {
  @ApiProperty({
    type: String,
    example: "CurrentPassword123!",
    description: "Current user password",
  })
  @IsString()
  @IsNotEmpty({ message: "Current password is required" })
  currentPassword!: string;

  @ApiProperty({
    type: String,
    example: "NewPassword123!",
    description:
      "New password (min 8 chars, at least 1 uppercase, 1 lowercase, 1 number)",
  })
  @IsString()
  @MinLength(8, { message: "New password must be at least 8 characters long" })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/, {
    message:
      "Password must contain at least 1 uppercase letter, 1 lowercase letter, and 1 number",
  })
  newPassword!: string;
}
