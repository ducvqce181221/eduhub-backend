import { Module } from "@nestjs/common";
import { MediaAssetsController } from "./media-assets.controller";
import { MediaAssetsService } from "./media-assets.service";
import { PrismaModule } from "../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [MediaAssetsController],
  providers: [MediaAssetsService],
  exports: [MediaAssetsService],
})
export class MediaAssetsModule {}
