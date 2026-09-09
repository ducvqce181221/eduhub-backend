import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsNotEmpty } from "class-validator";

export class UpdateUserRoleDto {
  @ApiProperty({
    type: String,
    enum: ["STUDENT", "TEACHER", "ADMIN"],
    example: "TEACHER",
    description: "New role for the user",
  })
  @IsNotEmpty({ message: "Role is required" })
  @IsEnum(["STUDENT", "TEACHER", "ADMIN"], {
    message: "Role must be STUDENT, TEACHER, or ADMIN",
  })
  role!: "STUDENT" | "TEACHER" | "ADMIN";
}
