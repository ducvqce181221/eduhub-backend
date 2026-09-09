import { Module } from "@nestjs/common";
import { CoursesController } from "./courses.controller";
import { MeCoursesController } from "./me-courses.controller";
import { CoursesService } from "./courses.service";
import { PrismaModule } from "../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { UploadModule } from "../upload/upload.module";

@Module({
  imports: [PrismaModule, AuthModule, UploadModule],
  controllers: [CoursesController, MeCoursesController],
  providers: [CoursesService],
  exports: [CoursesService],
})
export class CoursesModule {}
