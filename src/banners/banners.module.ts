import { Module } from "@nestjs/common";
import { BannersService } from "./banners.service";
import { BannersController } from "./banners.controller";
import { PrismaModule } from "../prisma/prisma.module";
import { RedisCacheModule } from "../common/cache/redis-cache.module";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [PrismaModule, RedisCacheModule, AuthModule],
  controllers: [BannersController],
  providers: [BannersService],
  exports: [BannersService],
})
export class BannersModule {}

