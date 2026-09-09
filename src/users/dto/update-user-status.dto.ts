import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsNotEmpty } from "class-validator";

export class UpdateUserStatusDto {
  @ApiProperty({
    type: Boolean,
    example: false,
    description: "New active status for the user account",
  })
  @IsNotEmpty({ message: "isActive status is required" })
  @IsBoolean({ message: "isActive must be a boolean" })
  isActive!: boolean;
}
