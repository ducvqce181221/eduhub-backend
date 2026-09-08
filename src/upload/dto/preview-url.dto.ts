import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class PreviewUrlDto {
  @ApiProperty({
    type: String,
    description: "Cloudflare R2 file URL or key or external video URL to generate preview for",
    example: "https://pub-bf7daf8cf49c4543879289550e1f1e19.r2.dev/videos/1788783914625-v6x-zoTW-1-lecture.mp4",
  })
  @IsString()
  @IsNotEmpty()
  url!: string;
}
