import { Module } from "@nestjs/common";
import { LessonsController } from "./lessons.controller";
import { ResourcesController } from "./resources.controller";
import { LessonsService } from "./lessons.service";
import { ResourcesService } from "./resources.service";
import { PrismaModule } from "../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { UploadModule } from "../upload/upload.module";

@Module({
  imports: [PrismaModule, AuthModule, UploadModule],
  controllers: [LessonsController, ResourcesController],
  providers: [LessonsService, ResourcesService],
  exports: [LessonsService, ResourcesService],
})
export class LessonsModule {}
