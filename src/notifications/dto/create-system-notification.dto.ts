import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, MaxLength } from "class-validator";

export class CreateSystemNotificationDto {
  @ApiProperty({
    type: String,
    example: "Platform Maintenance Announcement",
    description: "Title of the system announcement (max 200 chars)",
  })
  @IsNotEmpty({ message: "Title must not be empty" })
  @IsString({ message: "Title must be a string" })
  @MaxLength(200, { message: "Title must not exceed 200 characters" })
  title!: string;

  @ApiProperty({
    type: String,
    example: "EduHub will undergo scheduled maintenance on Saturday at 2 AM UTC.",
    description: "Message body of the system announcement",
  })
  @IsNotEmpty({ message: "Message must not be empty" })
  @IsString({ message: "Message must be a string" })
  message!: string;
}
